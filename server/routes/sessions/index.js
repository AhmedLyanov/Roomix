import {
  getSessions,
  getSession,
  deleteSession,
} from "../../services/session.service.js";

export default async function (fastify) {
  fastify.get("/:userId", async (request) => {
    const { userId } = request.params;

    return getSessions(userId);
  });
  

  fastify.get("/details/:id", async (request, reply) => {
    const { id } = request.params;

    const session = await getSession(id);

    if (!session) {
      return reply.code(404).send({
        message: "Session not found",
      });
    }

    return session;
  });

  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params;

    const session = await deleteSession(id);

    if (!session) {
      return reply.code(404).send({
        message: "Session not found",
      });
    }

    return reply.code(204).send();
  });
}