import * as ort from 'onnxruntime-web';

class OnnxWrapper {
    private session: ort.InferenceSession;
    private _state: number[][];
    private _context: number[];
    private _last_sr: number;
    private _last_batch_size: number;
    private sample_rates: number[];
    private sessionReady: Promise<void>;

    constructor(path: string, force_onnx_cpu: boolean = true) {
        console.log(`Initializing OnnxWrapper with path: ${path}`);
        this.sessionReady = this.initSession(path, force_onnx_cpu);
        this.resetStates();
        this.sample_rates = [8000, 16000];
    }

    async ready(): Promise<void> {
        console.log('Waiting for OnnxWrapper session to be ready');
        await this.sessionReady;
        console.log('OnnxWrapper session is ready');
    }

    private async initSession(path: string, force_onnx_cpu: boolean) {
        console.log(`Initializing ONNX session with force_onnx_cpu: ${force_onnx_cpu}`);
        const options: ort.InferenceSession.SessionOptions = {
            executionProviders: force_onnx_cpu ? ['wasm'] : ['webgl', 'wasm'],
            graphOptimizationLevel: 'all',
            executionMode: 'sequential',
            enableCpuMemArena: true,
            enableMemPattern: true,
            extra: {
                session: {
                    intra_op_num_threads: 1,
                    inter_op_num_threads: 1,
                }
            }
        };

        this.session = await ort.InferenceSession.create(path, options);
        console.log('ONNX session created successfully');
    }

    private _validate_input(x: number[][], sr: number): [number[][], number] {
        if (!Array.isArray(x[0])) {
            x = [x as unknown as number[]];
        }
        if (x.length > 2) {
            throw new Error(`Too many dimensions for input audio chunk ${x.length}`);
        }
        if (sr !== 16000 && (sr % 16000 === 0)) {
            const step = Math.floor(sr / 16000);
            x = x.map(row => row.filter((_, i) => i % step === 0));
            sr = 16000;
        }
        if (!this.sample_rates.includes(sr)) {
            throw new Error(`Supported sampling rates: ${this.sample_rates} (or multiply of 16000)`);
        }
        if (sr / x[0].length > 31.25) {
            throw new Error("Input audio chunk is too short");
        }
        return [x, sr];
    }

    resetStates(batch_size: number = 1): void {
        console.log(`Resetting states with batch_size: ${batch_size}`);
        this._state = Array(2).fill(0).map(() => Array(batch_size * 128).fill(0));
        this._context = [];
        this._last_sr = 0;
        this._last_batch_size = 0;
    }

    async call(x: number[][], sr: number): Promise<number[][]> {
        console.log(`Calling model with input shape: [${x.length}, ${x[0].length}], sample rate: ${sr}`);
        await this.ready();
        [x, sr] = this._validate_input(x, sr);
        const num_samples = sr === 16000 ? 512 : 256;

        if (x[0].length !== num_samples) {
            throw new Error(`Provided number of samples is ${x[0].length} (Supported values: 256 for 8000 sample rate, 512 for 16000)`);
        }

        const batch_size = x.length;
        const context_size = sr === 16000 ? 64 : 32;

        if (!this._last_batch_size) {
            this.resetStates(batch_size);
        }
        if (this._last_sr && this._last_sr !== sr) {
            this.resetStates(batch_size);
        }
        if (this._last_batch_size && this._last_batch_size !== batch_size) {
            this.resetStates(batch_size);
        }
        if (this._context.length === 0) {
            this._context = Array(batch_size * context_size).fill(0);
        }

        x = x.map((row, i) => [...this._context.slice(i * context_size, (i + 1) * context_size), ...row]);

        if (sr === 8000 || sr === 16000) {
            const inputTensor = new ort.Tensor('float32', x.flat(), [batch_size, x[0].length]);
            const stateTensor = new ort.Tensor('float32', this._state.flat(), [2, batch_size, 128]);
            const srTensor = new ort.Tensor('int64', [sr], []);

            const feeds: Record<string, ort.Tensor> = {
                input: inputTensor,
                state: stateTensor,
                sr: srTensor
            };

            const results = await this.session.run(feeds);
            const outputData = results.output.data as Float32Array;
            const stateData = results.stateN.data as Float32Array;

            this._state = Array(2).fill(0).map((_, i) => 
                Array.from(stateData.slice(i * batch_size * 128, (i + 1) * batch_size * 128))
            );

            const outputShape = results.output.dims as number[];
            const out = Array(outputShape[0]).fill(0).map((_, i) => 
                Array.from(outputData.slice(i * outputShape[1], (i + 1) * outputShape[1]))
            );

            this._context = x.map(row => row.slice(-context_size)).flat();
            this._last_sr = sr;
            this._last_batch_size = batch_size;

            console.log(`Model call completed, output shape: [${out.length}, ${out[0].length}]`);
            return out;
        } else {
            throw new Error(`Unsupported sample rate: ${sr}. Supported rates are 8000 and 16000.`);
        }
    }

    async audio_forward(x: number[][], sr: number): Promise<number[][]> {
        console.log(`Running audio_forward with input shape: [${x.length}, ${x[0].length}], sample rate: ${sr}`);
        const outs: number[][][] = [];
        [x, sr] = this._validate_input(x, sr);
        this.resetStates();
        const num_samples = sr === 16000 ? 512 : 256;

        if (x[0].length % num_samples !== 0) {
            const pad_num = num_samples - (x[0].length % num_samples);
            x = x.map(row => [...row, ...Array(pad_num).fill(0)]);
        }

        for (let i = 0; i < x[0].length; i += num_samples) {
            const wavs_batch = x.map(row => row.slice(i, i + num_samples));
            const out_chunk = await this.call(wavs_batch, sr);
            outs.push(out_chunk);
        }

        console.log(`audio_forward completed, output shape: [${outs.length}, ${outs[0].length}]`);
        return outs.reduce((acc, curr) => acc.map((row, i) => [...row, ...curr[i]]));
    }

    close(): void {
        console.log('Closing OnnxWrapper session');
        this.session.release();
    }
}

export default OnnxWrapper;