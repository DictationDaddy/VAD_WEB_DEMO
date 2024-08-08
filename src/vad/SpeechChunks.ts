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

    constructor() {
        this.chunks = [];
        this.isSpeechActive = false;

        this.microphoneAudio = new MicrophoneAudio({
            sampleRate: SpeechChunks.SAMPLE_RATE,
            windowSizeSamples: SpeechChunks.WINDOW_SIZE_SAMPLES,
            onAudioData: this.processAudioData.bind(this)
        });
        
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
            } else if (result.end !== undefined) {
                this.isSpeechActive = false;
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

    async close(): Promise<void> {
        this.stop();
        await this.vadDetector.close();
    }
}