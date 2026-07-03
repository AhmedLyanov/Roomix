import swaggerPlugin from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

async function swagger(fastify) {
  await fastify.register(swaggerPlugin, {
    openapi: {
      info: {
        title: "Merriweather API",
        description: "Merriweather Backend API",
        version: "1.0.0",
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: "/docs",
  });
}

export default swagger;
export const autoConfig = true;
