import fp from "fastify-plugin";
import { Server } from "socket.io";

import {
  createSession,
  joinParticipant,
  updateParticipantLanguage,
  leaveParticipant,
  finishSession,
} from "../services/session.service.js";

import { translationService } from "../services/translation.service.js";
import { speechService } from "../services/speech.service.js";
import RoomMessage from "../models/RoomMessage.model.js";

export default fp(async function (fastify) {
  const rooms = new Map();
  const users = new Map();

  const io = new Server(fastify.server, {
    path: "/ws",
    cors: {
      origin: process.env.FRONTEND_URL || "*",
      methods: ["GET", "POST"],
    },
    maxHttpBufferSize: 1e6,
  });

  io.on("connection", (socket) => {
    socket.on(
      "join-room",
      async ({ roomId, userId, userName, nativeLanguage, userAvatar }) => {
        socket.join(roomId);

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Map());
        }

        const room = rooms.get(roomId);

        const participant = {
          socketId: socket.id,
          userId,
          userName,
          nativeLanguage,
          cameraEnabled: true,
          microphoneEnabled: true,
          userAvatar,
        };

        room.set(socket.id, participant);

        users.set(socket.id, {
          userId,
          userName,
          roomId,
          nativeLanguage,
          userAvatar,
        });

        const existingUsers = Array.from(room.values())
          .filter((user) => user.socketId !== socket.id)
          .map((user) => ({
            socketId: user.socketId,
            userName: user.userName,
            userAvatar: user.userAvatar,
            cameraEnabled: user.cameraEnabled,
            microphoneEnabled: user.microphoneEnabled,
          }));

        if (existingUsers.length) {
          socket.emit("existing-users", {
            users: existingUsers,
          });
        }

        socket.to(roomId).emit("user-connected", {
          socketId: participant.socketId,
          userId: participant.userId,
          userName: participant.userName,
          userAvatar: participant.userAvatar,
          cameraEnabled: participant.cameraEnabled,
          microphoneEnabled: participant.microphoneEnabled,
        });


        try {
          const session = await createSession({
            roomId,
            ownerId: userId,
            ownerName: userName,
            ownerAvatar: userAvatar,
            language: nativeLanguage,
          });


          if (!users.has(socket.id)) {
            return;
          }
          if (String(session.ownerId) !== userId) {
            await joinParticipant({
              roomId,
              userId,
              userName,
              avatar: userAvatar,
              language: nativeLanguage,
            });
          }
        } catch (error) {
          fastify.log.error(error);
        }
      },
    );

    socket.on("offer", ({ offer, to }) => {
      io.to(to).emit("offer", { offer, from: socket.id });
    });

    socket.on("answer", ({ answer, to }) => {
      io.to(to).emit("answer", { answer, from: socket.id });
    });

    socket.on("ice-candidate", ({ candidate, to }) => {
      io.to(to).emit("ice-candidate", { candidate, from: socket.id });
    });

    socket.on("chat:send", async (payload) => {
      try {
        const message = await RoomMessage.create({
          roomId: payload.roomId,
          senderId: payload.senderId,
          senderName: payload.senderName,
          senderAvatar: payload.senderAvatar,
          text: payload.text,
          type: "text",
        });

        io.to(payload.roomId).emit("chat:new", message);
      } catch (error) {
        console.error(error);
      }
    });

    socket.on("audio-chunk", async (audioChunk) => {
      try {
        const speaker = users.get(socket.id);
        if (!speaker) return;

        const room = rooms.get(speaker.roomId);
        if (!room) return;

        await speechService.addAudioChunk(
          socket.id,
          audioChunk,
          speaker,
          async (result) => {
            if (!result.text?.trim()) return;
            const listenersByLanguage = new Map();

            for (const [participantId, participant] of room) {
              if (participantId === socket.id) continue;

              const lang = participant.nativeLanguage;
              if (!listenersByLanguage.has(lang)) {
                listenersByLanguage.set(lang, []);
              }
              listenersByLanguage.get(lang).push(participantId);
            }

            socket.emit("subtitle", {
              originalText: result.text,
              translatedText: result.text,
              speakerId: socket.id,
              sourceLanguage: speaker.nativeLanguage,
              targetLanguage: speaker.nativeLanguage,
            });

            for (const [targetLang, listenerIds] of listenersByLanguage) {
              try {
                let translatedText = result.text;

                if (targetLang !== speaker.nativeLanguage) {
                  translatedText = await translationService.translate({
                    text: result.text,
                    source: speaker.nativeLanguage,
                    target: targetLang,
                  });
                }

                for (const listenerId of listenerIds) {
                  io.to(listenerId).emit("subtitle", {
                    originalText: result.text,
                    translatedText,
                    speakerId: socket.id,
                    sourceLanguage: speaker.nativeLanguage,
                    targetLanguage: targetLang,
                  });
                }
              } catch (error) {
                console.error("[WebSocket] Translation error:", error.message);
                for (const listenerId of listenerIds) {
                  io.to(listenerId).emit("subtitle", {
                    originalText: result.text,
                    translatedText: result.text,
                    speakerId: socket.id,
                    sourceLanguage: speaker.nativeLanguage,
                    targetLanguage: targetLang,
                  });
                }
              }
            }
          },
        );
      } catch (err) {
        console.error("[WebSocket] Audio chunk error:", err.message);
      }
    });

    socket.on("language:update", async ({ roomId, userId, language }) => {
      const user = users.get(socket.id);

      if (user) {
        user.nativeLanguage = language;
      }

      const room = rooms.get(roomId);

      if (room) {
        const participant = room.get(socket.id);

        if (participant) {
          participant.nativeLanguage = language;
        }
      }

      await updateParticipantLanguage({
        roomId,
        userId,
        language,
      });
    });

    socket.on("camera:update", ({ roomId, enabled }) => {
      const room = rooms.get(roomId);

      if (!room) return;

      const participant = room.get(socket.id);

      if (!participant) return;

      participant.cameraEnabled = enabled;

      socket.to(roomId).emit("camera:update", {
        socketId: socket.id,
        enabled,
      });
    });

    socket.on("mic:update", ({ roomId, enabled }) => {
      const room = rooms.get(roomId);

      if (!room) return;

      const participant = room.get(socket.id);

      if (!participant) return;

      participant.microphoneEnabled = enabled;

      socket.to(roomId).emit("mic:update", {
        socketId: socket.id,
        enabled,
      });
    });

    socket.on("disconnect", async () => {
      speechService.cleanup(socket.id);

      const user = users.get(socket.id);
      if (!user) return;

      const { roomId, userId } = user;

      await leaveParticipant({ roomId, userId });

      if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        room.delete(socket.id);

        if (room.size === 0) {
          await finishSession(roomId);
          rooms.delete(roomId);
        }

        socket.to(roomId).emit("user-disconnected", {
          socketId: socket.id,
        });
      }

      users.delete(socket.id);
    });
  });

  fastify.decorate("io", io);
});

export const autoConfig = true;
