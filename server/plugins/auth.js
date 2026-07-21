import fp from "fastify-plugin";
import { verifyToken } from "@clerk/backend";

export default fp(async function (fastify) {
  fastify.decorate("authenticate", async (request, reply) => {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return reply.code(401).send({
        message: "Missing authorization header",
      });
    }

    const token = authorization.replace("Bearer ", "");

    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });

      request.user = {
        userId: payload.sub,
      };
    } catch (error) {
      console.error(error);

      return reply.code(401).send({
        message: "Invalid token",
      });
    }
  });
});