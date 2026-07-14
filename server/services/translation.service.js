export class TranslationService {
  constructor() {
    this.baseUrl = process.env.TRANSLATION_SERVICE_URL;
  }

  async translate({ text, source, target }) {
    if (!this.baseUrl) {
      console.error("[TranslationService] TRANSLATION_SERVICE_URL not configured");
      return text;
    }

    if (!text?.trim()) return text;
    
    if (source === target) return text;

    try {
      const response = await fetch(`${this.baseUrl}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, source, target }),
      });

      if (!response.ok) {
        console.error(
          `[TranslationService] Failed: ${source}->${target}, status: ${response.status}`
        );
        return text;
      }

      const data = await response.json();
      return data.translation || text;
    } catch (error) {
      console.error(
        `[TranslationService] Error (${source}->${target}): ${error.message}`
      );
      return text;
    }
  }
}

export const translationService = new TranslationService();