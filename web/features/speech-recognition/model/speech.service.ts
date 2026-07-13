const LANGUAGE_MAP: Record<string, string> = {
  ru: "ru-RU",
  en: "en-US",
  de: "de-DE",
  fr: "fr-FR",
  es: "es-ES",
  it: "it-IT",
  zh: "zh-CN",
  ja: "ja-JP",
  ko: "ko-KR",
};

export class SpeechService {
  private recognition: SpeechRecognition | null = null;
  private isStopping = false;
  private onResultCallback: ((text: string) => void) | null = null;
  private language: string;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private startTime = 0;
  private quickFailCount = 0;

  constructor(language: string = "ru") {
    this.language = language;
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      throw new Error("Speech Recognition is not supported.");
    }
  }

  private create() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    this.recognition = new SpeechRecognition();
    this.recognition.lang = LANGUAGE_MAP[this.language] ?? "en-US";
    this.recognition.continuous = false; // ВАЖНО: false — Chrome стабильнее
    this.recognition.interimResults = true; // ВАЖНО: true — Chrome держит открытым
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      console.log("[SpeechService] ✅ started");
      this.startTime = Date.now();
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const last = event.results[event.results.length - 1];
      if (!last.isFinal) return;

      const text = last[0].transcript.trim();
      console.log("[SpeechService] 📝 final:", text);
      if (text && this.onResultCallback) {
        this.onResultCallback(text);
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "aborted" || event.error === "no-speech") {
        console.log("[SpeechService]", event.error);
        return;
      }
      console.error("[SpeechService] error:", event.error);
    };

    this.recognition.onend = () => {
      const duration = Date.now() - this.startTime;
      console.log("[SpeechService] 🏁 ended, duration:", duration, "ms");

      if (this.isStopping) return;
      let delay = 300;
      if (duration < 500) {
        this.quickFailCount++;
        delay = Math.min(500 * this.quickFailCount, 3000);
        console.log(
          "[SpeechService] quick fail",
          this.quickFailCount,
          "delay:",
          delay,
        );
      } else {
        this.quickFailCount = 0;
      }

      if (this.quickFailCount > 8) {
        console.error("[SpeechService] too many quick fails, giving up");
        return;
      }

      this.restartTimer = setTimeout(() => {
        if (!this.isStopping) this.start();
      }, delay);
    };
  }

  start() {
    if (this.isStopping) return;
    if (!this.recognition) this.create();

    try {
      this.recognition?.start();
    } catch (err) {
      console.error("[SpeechService] start failed:", err);
      this.recognition = null;
      this.restartTimer = setTimeout(() => {
        if (!this.isStopping) this.start();
      }, 1000);
    }
  }

  stop() {
    console.log("[SpeechService] ⏹️ stop");
    this.isStopping = true;
    this.quickFailCount = 0;

    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    try {
      this.recognition?.stop();
    } catch {}

    this.recognition = null;
  }

  setLanguage(language: string) {
    this.language = language;
    if (this.recognition) {
      this.recognition.lang = LANGUAGE_MAP[language] ?? "en-US";
    }
  }

  onResult(callback: (text: string) => void) {
    this.onResultCallback = callback;
  }
}
