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
      async ({
        roomId,
        userId,
        userName,
        speechLanguage,
        translationLanguage,
      }) => {
        console.log("[WebSocket] 📥 'join-room' from:", socket.id, {
          roomId,
          userId,
          userName,
          speechLanguage,
          translationLanguage,
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
          speechLanguage,
          translationLanguage,
        });

        users.set(socket.id, {
          userId,
          userName,
          roomId,
          speechLanguage,
          translationLanguage,
        });

        console.log("[WebSocket] 👥 Room", roomId, "participants:", Array.from(room.values()).map(u => ({
          socketId: u.socketId,
          userName: u.userName,
          speechLanguage: u.speechLanguage,
          translationLanguage: u.translationLanguage,
        })));

        await createSession({
          roomId,
          ownerId: userId,
          ownerName: userName,
          language: speechLanguage,
        });

        await joinParticipant({
          roomId,
          userId,
          userName,
          language: speechLanguage,
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
        const user = users.get(socket.id);
        console.log("[WebSocket] 🔍 User lookup:", user ? "FOUND" : "NOT FOUND");

        if (!user) {
          console.error("[WebSocket] ❌ User not found for socket:", socket.id);
          return;
        }

        console.log("[WebSocket] 🌐 Translating:", {
          text,
          source: user.speechLanguage,
          target: user.translationLanguage,
        });

        const translated = await translationService.translate({
          text,
          source: user.speechLanguage,
          target: user.translationLanguage,
        });

        console.log("[WebSocket] ✅ Translation result:", translated);

        const subtitleData = {
          originalText: text,
          translatedText: translated,
          sourceLanguage: user.speechLanguage,
          targetLanguage: user.translationLanguage,
        };

        console.log("[WebSocket] 📤 Emitting 'subtitle' to socket:", socket.id);
        socket.emit("subtitle", subtitleData);
        console.log("[WebSocket] ✅ 'subtitle' emitted");
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