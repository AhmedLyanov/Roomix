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
  private recognition: SpeechRecognition;
  private isRunning: boolean = false;
  private restartTimeout: ReturnType<typeof setTimeout> | null = null;
  private onResultCallback: ((text: string) => void) | null = null;
  private isStopping: boolean = false;

  constructor(language: string = "ru") {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      throw new Error("Speech Recognition is not supported.");
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = LANGUAGE_MAP[language] ?? "en-US";
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;

    this.bindEventHandlers();
  }

  private bindEventHandlers() {
    this.recognition.onstart = () => {
      console.log("[SpeechService] ✅ onstart — recognition started");
      this.isRunning = true;
      this.isStopping = false;
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      console.log(
        "[SpeechService] 🎤 onresult — results length:",
        event.results.length,
      );

      const result = event.results[event.results.length - 1];

      if (!result.isFinal) {
        console.log("[SpeechService] ⏳ interim result, skipping");
        return;
      }

      const text = result[0].transcript.trim();
      console.log("[SpeechService] 📝 FINAL TEXT:", text);

      if (this.onResultCallback && text.length > 0) {
        this.onResultCallback(text);
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("[SpeechService] ❌ onerror:", event.error, event.message);

      if (event.error === "aborted") {
        if (this.isStopping) {
          console.log("[SpeechService] 🛑 aborted by manual stop — OK");
        } else {
          console.log("[SpeechService] ⚠️ aborted unexpectedly — will restart");
        }
      } else if (event.error === "no-speech") {
        console.log("[SpeechService] 🔇 no speech detected — will restart");
      } else if (event.error === "audio-capture") {
        console.error(
          "[SpeechService] 🎙️ audio-capture error — check microphone",
        );
      } else if (event.error === "not-allowed") {
        console.error(
          "[SpeechService] 🚫 not-allowed — microphone permission denied",
        );
      }
    };

    this.recognition.onend = () => {
      console.log(
        "[SpeechService] 🏁 onend — recognition ended, isRunning:",
        this.isRunning,
        "isStopping:",
        this.isStopping,
      );
      this.isRunning = false;

      if (this.isStopping) {
        console.log("[SpeechService] 🛑 manual stop confirmed, NOT restarting");
        return;
      }

      // Автоперезапуск с задержкой
      console.log("[SpeechService] 🔄 scheduling restart in 200ms...");
      this.restartTimeout = setTimeout(() => {
        if (this.isStopping) {
          console.log(
            "[SpeechService] 🛑 restart cancelled — manual stop was called",
          );
          return;
        }
        try {
          console.log("[SpeechService] 🚀 restarting recognition...");
          this.recognition.start();
        } catch (err) {
          console.error("[SpeechService] ❌ restart failed:", err);
        }
      }, 200);
    };
  }

  start() {
    console.log(
      "[SpeechService] ▶️ start() called, isRunning:",
      this.isRunning,
      "isStopping:",
      this.isStopping,
    );

    if (this.isRunning) {
      console.log("[SpeechService] ⏭️ already running, skipping");
      return;
    }

    this.isStopping = false;

    try {
      this.recognition.start();
    } catch (err) {
      console.error("[SpeechService] ❌ start() failed:", err);
    }
  }

  stop() {
    console.log("[SpeechService] ⏹️ stop() called");
    this.isStopping = true;
    this.isRunning = false;

    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    try {
      this.recognition.stop();
    } catch (err) {
      console.error("[SpeechService] ❌ stop() error:", err);
    }
  }

  setLanguage(language: string) {
    const newLang = LANGUAGE_MAP[language] ?? "en-US";
    console.log("[SpeechService] 🌐 setLanguage:", newLang);
    this.recognition.lang = newLang;
  }

  onResult(callback: (text: string) => void) {
    console.log("[SpeechService] 🔗 onResult callback registered");
    this.onResultCallback = callback;
  }

  get isActive() {
    return this.isRunning;
  }
}
