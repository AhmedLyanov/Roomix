const LANGUAGE_MAP: Record<string, string> = {
  ru: "ru-RU",
  en: "en-US",
};

export class SpeechService {
  private recognition: SpeechRecognition;

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
  }

  start() {
    this.recognition.start();
  }

  stop() {
    this.recognition.stop();
  }

  setLanguage(language: string) {
    this.recognition.lang = LANGUAGE_MAP[language] ?? "en-US";
  }

  onResult(callback: (text: string) => void) {
    this.recognition.onresult = (event) => {
      const text = event.results[event.results.length - 1][0].transcript;

      callback(text);
    };
  }
}
