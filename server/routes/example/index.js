export default async function exampleRoute(fastify, opts) {
  fastify.get("/", async function (request, reply) {
    return "this is an example";
  });

  fastify.get("/start", async function (request, reply) {
    return "this is an example";
  });
}
