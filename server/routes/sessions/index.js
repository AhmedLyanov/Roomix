import {
  getSessions,
  getSession,
  deleteSession,
} from "../../services/session.service.js";

import {
  getSessionActions,
} from "../../services/session-action.service.js";

export default async function (fastify) {
  fastify.get(
    "/:userId",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const { userId } = request.params;

      return getSessions(userId);
    },
  );

  fastify.get(
    "/details/:id",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params;

      const session = await getSession(id);

      if (!session) {
        return reply.code(404).send({
          message: "Session not found",
        });
      }

      return session;
    },
  );

  fastify.get(
    "/:sessionId/actions",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const { sessionId } = request.params;

      return getSessionActions(sessionId);
    },
  );

  fastify.delete(
    "/:id",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params;

      const session = await deleteSession(id);

      if (!session) {
        return reply.code(404).send({
          message: "Session not found",
        });
      }

      return reply.code(204).send();
    },
  );
}
