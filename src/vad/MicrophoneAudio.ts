interface MicrophoneAudioOptions {
  sampleRate?: number;
  channels?: number;
  windowSizeSamples: number;
  onAudioData: (audioData: Float32Array) => void;
}

class MicrophoneAudio {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private options: MicrophoneAudioOptions;
  private buffer: Float32Array = new Float32Array();

  constructor(options: MicrophoneAudioOptions) {
    this.options = {
      sampleRate: 16000,
      channels: 1,
      ...options,
    };
  }

  async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.options.sampleRate,
          channelCount: this.options.channels,
        },
      });

      this.audioContext = new AudioContext({
        sampleRate: this.options.sampleRate,
      });

      await this.audioContext.audioWorklet.addModule(
        URL.createObjectURL(new Blob([`
          class AudioProcessor extends AudioWorkletProcessor {
            constructor() {
              super();
              this.buffer = new Float32Array();
            }

            process(inputs, outputs, parameters) {
              const input = inputs[0];
              const channelData = input[0];
              
              this.buffer = Float32Array.from([...this.buffer, ...channelData]);
              
              while (this.buffer.length >= ${this.options.windowSizeSamples}) {
                const chunk = this.buffer.slice(0, ${this.options.windowSizeSamples});
                this.port.postMessage(chunk);
                this.buffer = this.buffer.slice(${this.options.windowSizeSamples});
              }
              
              return true;
            }
          }

          registerProcessor('audio-processor', AudioProcessor);
        `], { type: 'application/javascript' }))
      );

      this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
      this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');

      this.workletNode.port.onmessage = (event) => {
        this.options.onAudioData(event.data);
      };

      this.sourceNode.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);
    } catch (error) {
      console.error('Error starting microphone:', error);
      throw error;
    }
  }

  stop(): void {
    if (this.workletNode) {
      this.workletNode.port.postMessage('flush');
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    // Send any remaining data in the buffer
    if (this.buffer.length > 0) {
      this.options.onAudioData(this.buffer);
      this.buffer = new Float32Array();
    }
  }
}

export default MicrophoneAudio;