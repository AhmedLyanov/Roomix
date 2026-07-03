import fp from "fastify-plugin";

// The use of fastify-plugin is required to export decorators to the outer scope.
export default fp(async function (fastify, opts) {
  fastify.decorate("someSupport", function () {
    return "hugs";
  });
});
