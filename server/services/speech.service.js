// Константы
const AUDIO_PAUSE_TIMEOUT_MS = 1500;
const MAX_AUDIO_BUFFER_BYTES = 64000; // ~2 секунды аудио при 16kHz 16-bit mono
const MIN_AUDIO_SIZE_BYTES = 3200; // ~100ms аудио

export class SpeechService {
  constructor() {
    this.baseUrl = process.env.SPEECH_SERVICE_URL || process.env.TRANSLATION_SERVICE_URL || "http://localhost:8000";
    this.audioBuffers = new Map();
    this.processingTimers = new Map();
  }

  async addAudioChunk(socketId, audioChunk, speaker, callback) {
    if (!this.audioBuffers.has(socketId)) {
      this.audioBuffers.set(socketId, {
        chunks: [],
        totalBytes: 0
      });
    }
    
    const buffer = this.audioBuffers.get(socketId);
    const chunk = Buffer.from(audioChunk);
    buffer.chunks.push(chunk);
    buffer.totalBytes += chunk.length;
    
    if (this.processingTimers.has(socketId)) {
      clearTimeout(this.processingTimers.get(socketId));
    }
    
    // Отправляем если накопилось достаточно аудио или прошло время паузы
    if (buffer.totalBytes >= MAX_AUDIO_BUFFER_BYTES) {
      await this.processBuffer(socketId, speaker, callback);
    } else {
      const timer = setTimeout(async () => {
        await this.processBuffer(socketId, speaker, callback);
      }, AUDIO_PAUSE_TIMEOUT_MS);
      
      this.processingTimers.set(socketId, timer);
    }
  }

  async processBuffer(socketId, speaker, callback) {
    const buffer = this.audioBuffers.get(socketId);
    if (!buffer || buffer.chunks.length === 0 || buffer.totalBytes < MIN_AUDIO_SIZE_BYTES) {
      this.audioBuffers.delete(socketId);
      this.processingTimers.delete(socketId);
      return;
    }
    
    const fullAudio = Buffer.concat(buffer.chunks);
    
    this.audioBuffers.delete(socketId);
    this.processingTimers.delete(socketId);
    
    try {
      const response = await fetch(`${this.baseUrl}/speech-to-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
        },
        body: fullAudio,
      });
      
      if (!response.ok) {
        console.error("[SpeechService] Service error:", response.status);
        return;
      }
      
      const result = await response.json();
      
      if (result.text?.trim()) {
        callback(result);
      }
    } catch (error) {
      console.error("[SpeechService] Error:", error.message);
    }
  }

  cleanup(socketId) {
    this.audioBuffers.delete(socketId);
    if (this.processingTimers.has(socketId)) {
      clearTimeout(this.processingTimers.get(socketId));
      this.processingTimers.delete(socketId);
    }
  }
}

export const speechService = new SpeechService();