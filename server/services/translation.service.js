export class TranslationService {
  constructor() {
    this.baseUrl = process.env.TRANSLATION_SERVICE_URL;
  }

  async translate({ text, source, target }) {
    try {
      const response = await fetch(`${this.baseUrl}/translate`, {
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

      if (!response.ok) {
  const error = await response.text();

  console.error("FastAPI ERROR:");
  console.error(error);

  throw new Error(`Translation service returned ${response.status}`);
}

      const data = await response.json();

      return data.translation;
    } catch (error) {
      console.error(error);

      throw error;
    }
  }
}

export const translationService = new TranslationService();
