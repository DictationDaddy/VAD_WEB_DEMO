import OnnxWrapper from './Silero'; // Assuming you have this class implemented
const modelPath = process.env.VAD_MODEL_PATH;

export class VadDetector {
    private model: OnnxWrapper;
    private startThreshold: number;
    private endThreshold: number;
    private samplingRate: number;
    private minSilenceSamples: number;
    private speechPadSamples: number;
    private triggered: boolean;
    private tempEnd: number;
    private currentSample: number;

    constructor(
        startThreshold: number,
        endThreshold: number,
        samplingRate: number,
        minSilenceDurationMs: number,
        speechPadMs: number
    ) {
        if (samplingRate !== 8000 && samplingRate !== 16000) {
            throw new Error("Does not support sampling rates other than [8000, 16000]");
        }

        this.model = new OnnxWrapper(modelPath);
        this.startThreshold = startThreshold;
        this.endThreshold = endThreshold;
        this.samplingRate = samplingRate;
        this.minSilenceSamples = samplingRate * minSilenceDurationMs / 1000;
        this.speechPadSamples = samplingRate * speechPadMs / 1000;
        this.reset();
        console.log(`VadDetector initialized with: startThreshold=${startThreshold}, endThreshold=${endThreshold}, samplingRate=${samplingRate}`);
    }

    reset(): void {
        this.model.resetStates();
        this.triggered = false;
        this.tempEnd = 0;
        this.currentSample = 0;
        console.log('VadDetector reset');
    }

    async apply(data: Float32Array, returnSeconds: boolean): Promise<{ start?: number; end?: number }> {
        console.log(`Applying VAD to data of length ${data.length}`);
        const windowSizeSamples = data.length;
        this.currentSample += windowSizeSamples;

        // Determine the row length based on the sampling rate
        const rowLength = this.samplingRate === 16000 ? 512 : 256;

        // Calculate the number of rows
        const numRows = Math.ceil(data.length / rowLength);

        // Create the 2D array
        const x: number[][] = [];
        for (let i = 0; i < numRows; i++) {
            const start = i * rowLength;
            const end = Math.min(start + rowLength, data.length);
            x.push(Array.from(data.slice(start, end)));

            // If the last row is not full, pad it with zeros
            if (end - start < rowLength) {
                x[i] = x[i].concat(new Array(rowLength - (end - start)).fill(0));
            }
        }

        let speechProb: number;
        try {
            let speechProbPromise = await this.model.call(x, this.samplingRate);
            if (speechProbPromise && Array.isArray(speechProbPromise) && speechProbPromise[0]) {
                speechProb = speechProbPromise[0][0];
                console.log(`Speech probability: ${speechProb}`);
            } else {
                throw new Error("Unexpected response from model");
            }
        } catch (e) {
            console.error("Error in VadDetector.apply:", e);
            throw new Error("Error calling the model: " + e);
        }

        if (speechProb >= this.startThreshold && this.tempEnd !== 0) {
            this.tempEnd = 0;
        }

        if (speechProb >= this.startThreshold && !this.triggered) {
            this.triggered = true;
            let speechStart = Math.max(this.currentSample - this.speechPadSamples, 0);
            console.log(`Speech start detected at sample ${speechStart}`);
            if (returnSeconds) {
                const speechStartSeconds = speechStart / this.samplingRate;
                return { start: Number(speechStartSeconds.toFixed(1)) };
            } else {
                return { start: speechStart };
            }
        }

        if (speechProb < this.endThreshold && this.triggered) {
            console.log(`Potential speech end at sample ${this.currentSample}`);
            if (this.tempEnd === 0) {
                this.tempEnd = this.currentSample;
            }
            
            if (this.currentSample - this.tempEnd < this.minSilenceSamples) {
                console.log('Silence duration too short, continuing');
                return {};
            } else {
                const speechEnd = this.tempEnd + this.speechPadSamples;
                console.log(`Speech end confirmed at sample ${speechEnd}`);
                this.tempEnd = 0;
                this.triggered = false;

                if (returnSeconds) {
                    const speechEndSeconds = speechEnd / this.samplingRate;
                    return { end: Number(speechEndSeconds.toFixed(1)) };
                } else {
                    return { end: speechEnd };
                }
            }
        }

        return {};
    }

    async close(): Promise<void> {
        this.reset();
        await this.model.close();
    }
}
