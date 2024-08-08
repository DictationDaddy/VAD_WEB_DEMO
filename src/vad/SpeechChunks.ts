import MicrophoneAudio from './MicrophoneAudio';
import { VadDetector } from './VoiceActivityDetector';

export class SpeechChunks {
    private static readonly SAMPLE_RATE = 16000;
    private static readonly START_THRESHOLD = 0.6;
    private static readonly END_THRESHOLD = 0.45;
    private static readonly MIN_SILENCE_DURATION_MS = 600;
    private static readonly SPEECH_PAD_MS = 500;
    private static readonly WINDOW_SIZE_SAMPLES = 512;

    private chunks: number[][];
    private microphoneAudio: MicrophoneAudio;
    private vadDetector: VadDetector;
    private isSpeechActive: boolean;
    private onSpeechStart: () => void;
    private onSpeechEnd: (blob: Blob) => void;

    constructor(onSpeechStart, onSpeechEnd) {
        this.chunks = [];
        this.isSpeechActive = false;

        this.microphoneAudio = new MicrophoneAudio({
            sampleRate: SpeechChunks.SAMPLE_RATE,
            windowSizeSamples: SpeechChunks.WINDOW_SIZE_SAMPLES,
            onAudioData: this.processAudioData.bind(this)
        });
        
        this.onSpeechStart = onSpeechStart;
        this.onSpeechEnd = onSpeechEnd;

        this.vadDetector = new VadDetector(
            SpeechChunks.START_THRESHOLD,
            SpeechChunks.END_THRESHOLD,
            SpeechChunks.SAMPLE_RATE,
            SpeechChunks.MIN_SILENCE_DURATION_MS,
            SpeechChunks.SPEECH_PAD_MS
        );
    }

    private async processAudioData(audioData: Float32Array): Promise<void> {
        // console.log('Processing audio data', audioData.length);
        try{
            const result = await this.vadDetector.apply(audioData , false);
            if (result.start !== undefined) {
                this.isSpeechActive = true;
                this.onSpeechStart();
            } else if (result.end !== undefined) {
                this.isSpeechActive = false;
                this.onSpeechEnd(this.getBlob());
            }
            if (this.isSpeechActive) {
                this.chunks.push(Array.from(audioData));
            }
        } catch (error) {
            console.error('Error processing audio data', error);
        }
    }

    async start(): Promise<void> {
        await this.microphoneAudio.start();
    }
    
    stop(): void {
        this.microphoneAudio.stop();
        this.vadDetector.reset();
        this.isSpeechActive = false;
    }

    getSpeechChunks(): number[][] {
        const speechChunks = this.chunks;
        this.chunks = [];
        return speechChunks;
    }

    getBlob(): Blob {
        // Combine all chunks into a single Float32Array
        const combinedChunks = this.chunks;
        const combinedLength = combinedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const combinedAudio = new Float32Array(combinedLength);
        let offset = 0;
        for (const chunk of combinedChunks) {
            combinedAudio.set(chunk, offset);
            offset += chunk.length;
        }

        // Convert Float32Array to Int16Array (common format for WAV files)
        const intData = new Int16Array(combinedAudio.length);
        for (let i = 0; i < combinedAudio.length; i++) {
            const s = Math.max(-1, Math.min(1, combinedAudio[i]));
            intData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Create WAV file header
        const header = new ArrayBuffer(44);
        const view = new DataView(header);

        // RIFF chunk descriptor
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + intData.length * 2, true);
        this.writeString(view, 8, 'WAVE');

        // FMT sub-chunk
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // subchunk1size
        view.setUint16(20, 1, true); // audio format (1 for PCM)
        view.setUint16(22, 1, true); // num of channels
        view.setUint32(24, SpeechChunks.SAMPLE_RATE, true); // sample rate
        view.setUint32(28, SpeechChunks.SAMPLE_RATE * 2, true); // byte rate
        view.setUint16(32, 2, true); // block align
        view.setUint16(34, 16, true); // bits per sample

        // Data sub-chunk
        this.writeString(view, 36, 'data');
        view.setUint32(40, intData.length * 2, true);

        // Combine header and data
        const blob = new Blob([header, intData], { type: 'audio/wav' });
        return blob;
    }

    // Helper function to write strings to DataView
    private writeString(view: DataView, offset: number, string: string): void {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    async close(): Promise<void> {
        this.stop();
        await this.vadDetector.close();
    }
}