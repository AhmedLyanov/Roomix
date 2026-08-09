import fp from "fastify-plugin";
import multipart from "@fastify/multipart";

export default fp(async function (fastify) {
  await fastify.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024,
      files: 1,
    },
  });
});

export const autoConfig = true;