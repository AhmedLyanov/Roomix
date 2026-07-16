import { Socket } from "socket.io-client";

const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4096;
const CHANNELS = 1;
const VOICE_ACTIVITY_THRESHOLD = 0.01;
const CLIENT_SEND_INTERVAL_MS = 500;

export class AudioSender {
  private audioContext: AudioContext | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private mediaStream: MediaStream | null = null;

  private socket: Socket | null = null;

  private isActive = false;
  private isMicEnabled = true;

  private isTranslationEnabled = false;

  private chunkBuffer: Int16Array[] = [];
  private sendInterval: ReturnType<typeof setInterval> | null = null;

  constructor(socket: Socket) {
    this.socket = socket;
  }

  async start(stream: MediaStream): Promise<void> {
    this.mediaStream = stream;

    try {
      this.audioContext = new AudioContext({
        sampleRate: SAMPLE_RATE,
      });

      this.mediaStreamSource =
        this.audioContext.createMediaStreamSource(stream);

      if (this.audioContext.audioWorklet) {
        try {
          await this.audioContext.audioWorklet.addModule(
            URL.createObjectURL(
              new Blob([this.getAudioProcessorCode()], {
                type: "application/javascript",
              }),
            ),
          );

          this.audioWorkletNode = new AudioWorkletNode(
            this.audioContext,
            "audio-processor",
          );

          this.audioWorkletNode.port.onmessage = (event) => {
            if (
              !this.isActive ||
              !this.isMicEnabled ||
              !this.isTranslationEnabled
            ) {
              return;
            }

            const pcmData = new Int16Array(event.data);

            if (this.isSilence(pcmData)) return;

            this.chunkBuffer.push(pcmData);
          };

          this.mediaStreamSource.connect(this.audioWorkletNode);
          this.audioWorkletNode.connect(this.audioContext.destination);
        } catch {
          console.warn(
            "[AudioSender] AudioWorklet failed, using ScriptProcessor",
          );

          this.setupScriptProcessor();
        }
      } else {
        this.setupScriptProcessor();
      }

      this.sendInterval = setInterval(() => {
        this.flushBuffer();
      }, CLIENT_SEND_INTERVAL_MS);

      this.isActive = true;

      console.log(
        "[AudioSender] started, translation:",
        this.isTranslationEnabled,
      );
    } catch (error) {
      console.error("[AudioSender] Start error:", error);

      this.cleanup();

      throw error;
    }
  }

  private setupScriptProcessor(): void {
    if (!this.audioContext || !this.mediaStreamSource) return;

    const processor = this.audioContext.createScriptProcessor(
      BUFFER_SIZE,
      CHANNELS,
      CHANNELS,
    );

    processor.onaudioprocess = (event: AudioProcessingEvent) => {
      if (!this.isActive || !this.isMicEnabled || !this.isTranslationEnabled) {
        return;
      }

      const rawData = event.inputBuffer.getChannelData(0);

      const pcmData = this.float32ToInt16(rawData);

      if (this.isSilence(pcmData)) return;

      this.chunkBuffer.push(pcmData);
    };

    this.mediaStreamSource.connect(processor);
    processor.connect(this.audioContext.destination);
  }

  private getAudioProcessorCode(): string {
    return `
      class AudioProcessor extends AudioWorkletProcessor {
        process(inputs) {
          const input = inputs[0];

          if (input && input[0]) {
            const float32Data = input[0];
            const int16Data = new Int16Array(
              float32Data.length
            );

            for (
              let i = 0;
              i < float32Data.length;
              i++
            ) {
              const s = Math.max(
                -1,
                Math.min(
                  1,
                  float32Data[i]
                )
              );

              int16Data[i] =
                s < 0
                  ? s * 0x8000
                  : s * 0x7FFF;
            }

            this.port.postMessage(
              int16Data.buffer,
              [int16Data.buffer]
            );
          }

          return true;
        }
      }

      registerProcessor(
        "audio-processor",
        AudioProcessor
      );
    `;
  }

  private isSilence(pcmData: Int16Array): boolean {
    let sumSquares = 0;

    for (let i = 0; i < pcmData.length; i++) {
      const sample = pcmData[i] / 32768;

      sumSquares += sample * sample;
    }

    const rms = Math.sqrt(sumSquares / pcmData.length);

    return rms < VOICE_ACTIVITY_THRESHOLD;
  }

  private float32ToInt16(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);

    for (let i = 0; i < float32Array.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Array[i]));

      int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    return int16Array;
  }

  private flushBuffer(): void {
    if (
      this.chunkBuffer.length === 0 ||
      !this.socket?.connected ||
      !this.isTranslationEnabled
    ) {
      return;
    }

    const totalLength = this.chunkBuffer.reduce(
      (sum, chunk) => sum + chunk.length,
      0,
    );

    const combined = new Int16Array(totalLength);

    let offset = 0;

    for (const chunk of this.chunkBuffer) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    this.socket.emit("audio-chunk", combined.buffer);

    this.chunkBuffer = [];
  }

  setTranslationEnabled(enabled: boolean): void {
    this.isTranslationEnabled = enabled;

    console.log("[AudioSender] Translation:", enabled ? "ON" : "OFF");

    if (!enabled) {
      this.chunkBuffer = [];
    }
  }

  setMicEnabled(enabled: boolean): void {
    this.isMicEnabled = enabled;

    if (!enabled) {
      this.chunkBuffer = [];
    }
  }

  stop(): void {
    this.isActive = false;

    if (this.sendInterval) {
      clearInterval(this.sendInterval);
      this.sendInterval = null;
    }

    this.flushBuffer();

    this.cleanup();
  }

  private cleanup(): void {
    this.audioWorkletNode?.disconnect();

    this.audioWorkletNode = null;

    this.mediaStreamSource?.disconnect();

    this.mediaStreamSource = null;

    this.audioContext?.close();

    this.audioContext = null;

    this.mediaStream = null;

    this.chunkBuffer = [];
  }
}
