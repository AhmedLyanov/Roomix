import { translationService } from "../../services/translation.service.js";

export default async function (fastify) {
  fastify.post("/", async (request) => {

    const body = JSON.parse(request.body);

    const { text, source, target } = body;

    const translation = await translationService.translate({
      text,
      source,
      target,
    });

    return {
      translation,
    };
  });
}