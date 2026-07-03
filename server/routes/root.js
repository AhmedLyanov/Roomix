export default async function rootRoute(fastify, opts) {
  fastify.get("/", async function (request, reply) {
    return { root: true };
  });
}
