export class TranslationService {
  constructor() {
    this.baseUrl = process.env.TRANSLATION_SERVICE_URL;
    console.log("[TranslationService] 🏗️ initialized, baseUrl:", this.baseUrl);
  }

  async processSpeech(event) {
    // 1. Получить комнату
    // 2. Получить говорящего
    // 3. Сгруппировать участников
    // 4. Выполнить переводы
    // 5. Вернуть результат
  }

  async translate({ text, source, target }) {
    console.log("[TranslationService] 🔄 translate() called:", { text, source, target });

    if (!this.baseUrl) {
      console.error("[TranslationService] ❌ TRANSLATION_SERVICE_URL is not set!");
      throw new Error("TRANSLATION_SERVICE_URL is not configured");
    }

    try {
      const url = `${this.baseUrl}/translate`;
      console.log("[TranslationService] 📡 Fetching:", url);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          source,
          target,
        }),
      });

      console.log("[TranslationService] 📥 Response status:", response.status);

      if (!response.ok) {
        const error = await response.text();
        console.error("[TranslationService] ❌ FastAPI ERROR:", error);
        throw new Error(`Translation service returned ${response.status}`);
      }

      const data = await response.json();
      console.log("[TranslationService] ✅ Response data:", data);

      return data.translation;
    } catch (error) {
      console.error("[TranslationService] ❌ translate() error:", error);
      throw error;
    }
  }
}

export const translationService = new TranslationService();