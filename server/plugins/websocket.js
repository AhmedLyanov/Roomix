import fp from "fastify-plugin";
import { Server } from "socket.io";

import {
  createSession,
  joinParticipant,
  leaveParticipant,
  finishSession,
} from "../services/session.service.js";

import { translationService } from "../services/translation.service.js";

export default fp(async function (fastify) {
  const rooms = new Map();
  const users = new Map();

  const io = new Server(fastify.server, {
    path: "/ws",
    cors: {
      origin: process.env.FRONTEND_URL || "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("[WebSocket] 🔌 New connection, socket.id:", socket.id);

    socket.on(
      "join-room",
      async ({ roomId, userId, userName, nativeLanguage }) => {
        console.log("[WebSocket] 📥 'join-room' from:", socket.id, {
          roomId,
          userId,
          userName,
          nativeLanguage,
        });

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

        console.log("[WebSocket] 👥 Room", roomId, "participants:", Array.from(room.values()).map((u) => ({
          socketId: u.socketId,
          userName: u.userName,
          nativeLanguage: u.nativeLanguage,
        })));

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
          console.log("[WebSocket] 📤 Emitting existing-users to:", socket.id);
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

    socket.on("speech", async ({ text }) => {
      console.log("[WebSocket] 📥 'speech' event from:", socket.id, "text:", text);

      try {
        const speaker = users.get(socket.id);
        console.log("[WebSocket] 🔍 Speaker lookup:", speaker ? "FOUND" : "NOT FOUND");

        if (!speaker) {
          console.error("[WebSocket] ❌ Speaker not found for socket:", socket.id);
          return;
        }

        const room = rooms.get(speaker.roomId);
        if (!room) {
          console.error("[WebSocket] ❌ Room not found:", speaker.roomId);
          return;
        }

        console.log("[WebSocket] 🌐 Speaker language:", speaker.nativeLanguage);

        const targetLanguages = new Set();
        for (const [sid, participant] of room) {
          if (sid !== socket.id) {
            targetLanguages.add(participant.nativeLanguage);
          }
        }

        console.log("[WebSocket] 🎯 Target languages:", Array.from(targetLanguages));
        const translations = new Map();
        for (const targetLang of targetLanguages) {
          if (targetLang === speaker.nativeLanguage) {
            translations.set(targetLang, text);
            console.log("[WebSocket] 💾 Cached translation for", targetLang, ":", text);
          } else {
            console.log("[WebSocket] 🔄 Translating:", text, "from", speaker.nativeLanguage, "to", targetLang);
            const translated = await translationService.translate({
              text,
              source: speaker.nativeLanguage,
              target: targetLang,
            });
            translations.set(targetLang, translated);
            console.log("[WebSocket] ✅ Translated to", targetLang, ":", translated);
          }
        }
        socket.emit("subtitle", {
          originalText: text,
          translatedText: text,
          speakerId: socket.id,
          sourceLanguage: speaker.nativeLanguage,
          targetLanguage: speaker.nativeLanguage,
        });
        console.log("[WebSocket] 📤 Sent original subtitle to speaker:", socket.id);
        for (const [listenerSocketId, listener] of room) {
          if (listenerSocketId === socket.id) continue;

          const translatedText = translations.get(listener.nativeLanguage) || text;

          io.to(listenerSocketId).emit("subtitle", {
            originalText: text,
            translatedText,
            speakerId: socket.id,
            sourceLanguage: speaker.nativeLanguage,
            targetLanguage: listener.nativeLanguage,
          });
          console.log("[WebSocket] 📤 Sent translated subtitle to:", listenerSocketId, "language:", listener.nativeLanguage);
        }
      } catch (err) {
        console.error("[WebSocket] ❌ Error in speech handler:", err);
      }
    });

    socket.on("disconnect", async () => {
      console.log("[WebSocket] 🔌 disconnect, socket.id:", socket.id);

      const user = users.get(socket.id);
      if (!user) {
        console.log("[WebSocket] ⚠️ No user found for disconnecting socket");
        return;
      }

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