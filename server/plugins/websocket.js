import fp from "fastify-plugin";
import { Server } from "socket.io";

import {
  createSession,
  joinParticipant,
  leaveParticipant,
  finishSession,
} from "../services/session.service.js";

import { translationService } from "../services/translation.service.js";
import { speechService } from "../services/speech.service.js";

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
      async ({ roomId, userId, userName, nativeLanguage }) => {
        socket.join(roomId);

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Map());
        }

        const room = rooms.get(roomId);

        room.set(socket.id, {
          socketId: socket.id,
          userId,
          userName,
          nativeLanguage,
        });

        users.set(socket.id, {
          userId,
          userName,
          roomId,
          nativeLanguage,
        });

        await createSession({
          roomId,
          ownerId: userId,
          ownerName: userName,
          language: nativeLanguage,
        });

        await joinParticipant({
          roomId,
          userId,
          userName,
          language: nativeLanguage,
        });

        const existingUsers = Array.from(room.values())
          .filter((participant) => participant.socketId !== socket.id)
          .map((participant) => ({
            socketId: participant.socketId,
            userName: participant.userName,
          }));

        if (existingUsers.length > 0) {
          socket.emit("existing-users", { users: existingUsers });
        }

        socket.to(roomId).emit("user-connected", {
          socketId: socket.id,
          userId,
          userName,
        });
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

    socket.on("audio-chunk", async (audioChunk) => {
      try {
        const speaker = users.get(socket.id);
        if (!speaker) return;

        const room = rooms.get(speaker.roomId);
        if (!room) return;

        await speechService.addAudioChunk(socket.id, audioChunk, speaker, async (result) => {
          if (!result.text?.trim()) return;
          
          // Группируем слушателей по языкам
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
          
          // Для каждого языка переводим один раз и отправляем всем
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
              // Fallback: отправляем оригинал если перевод не удался
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
        });
      } catch (err) {
        console.error("[WebSocket] Audio chunk error:", err.message);
      }
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