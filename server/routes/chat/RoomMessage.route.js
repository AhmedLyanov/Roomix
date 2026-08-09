import path from "node:path";
import crypto from "node:crypto";
import { pipeline } from "node:stream/promises";
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";

import RoomMessage from "../../models/RoomMessage.model.js";
import User from "../../models/User.js";
import Session from "../../models/Session.model.js";

import { createSessionAction } from "../../services/session-action.service.js";

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

  fastify.post(
    "/:roomId/files",
    {
      preHandler: fastify.authenticate,
    },
    async (request, reply) => {
      try {
        const { roomId } = request.params;
        const userId = request.user.userId;

        const user = await User.findOne({
          clerkId: userId,
        });

        if (!user) {
          return reply.code(404).send({
            message: "User not found",
          });
        }

        const data = await request.file();

        if (!data) {
          return reply.code(400).send({
            message: "File is required",
          });
        }

        const uploadDir = path.join(process.cwd(), "uploads");

        await fs.mkdir(uploadDir, {
          recursive: true,
        });

        const extension = path.extname(data.filename);

        const storedName = `${crypto.randomUUID()}${extension}`;

        const filePath = path.join(uploadDir, storedName);

        await pipeline(data.file, createWriteStream(filePath));

        if (data.file.truncated) {
          await fs.rm(filePath, {
            force: true,
          });

          return reply.code(413).send({
            message: "File is too large",
          });
        }

        const stats = await fs.stat(filePath);

        const message = await RoomMessage.create({
          roomId,

          senderId: user.clerkId,

          senderName:
            user.username || `${user.firstName} ${user.lastName}`.trim(),

          senderAvatar: user.avatar,

          type: "file",

          file: {
            originalName: data.filename,
            storedName,
            mimeType: data.mimetype,
            size: stats.size,
            url: `/uploads/${storedName}`,
          },
        });

    

        const session = await Session.findOne({
          roomId,
          endedAt: { $exists: false },
        });


        if (session) {
          const action = await createSessionAction({
            sessionId: session._id,
            type: "FILE_UPLOADED",
            userId,
            metadata: {
              fileName: data.filename,
              fileSize: stats.size,
              mimeType: data.mimetype,
              messageId: message._id,
            },
          });


        } else {
          return reply.code(404).send({
            message: "Session not found",
          })
        }

        fastify.io.to(roomId).emit("chat:new", message);

        return reply.code(201).send(message);
      } catch (error) {
        fastify.log.error(error);

        return reply.code(500).send({
          message: "Failed to upload file",
        });
      }
    },
  );

  fastify.get("/:roomId/files", async (request, reply) => {
    try {
      const { roomId } = request.params;

      const files = await RoomMessage.find({
        roomId,
        type: "file",
      }).sort({
        createdAt: -1,
      });

      return reply.send(files);
    } catch (error) {
      fastify.log.error(error);

      return reply.code(500).send({
        message: "Failed to load room files",
      });
    }
  });
}
