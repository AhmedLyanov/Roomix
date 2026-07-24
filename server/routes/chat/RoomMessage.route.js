import RoomMessage from "../../models/RoomMessage.model.js";

export default async function chatRoutes(fastify) {
  fastify.get("/:roomId/messages", async (request, reply) => {
    try {
      const { roomId } = request.params;

      const messages = await RoomMessage.find({
        roomId,
      }).sort({
        createdAt: 1,
      });

      return reply.send(messages);
    } catch (error) {
      fastify.log.error(error);

      return reply.code(500).send({
        message: "Failed to load room messages",
      });
    }
  });
}