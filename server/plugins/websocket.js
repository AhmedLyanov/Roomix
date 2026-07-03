import fp from "fastify-plugin";
import { Server } from "socket.io";

export default fp(async function (fastify, opts) {
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
    socket.on("join-room", ({ roomId, userId, userName }) => {
      socket.join(roomId);

      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
      }

      const room = rooms.get(roomId);
      room.add(socket.id);
      users.set(socket.id, { userId, userName, roomId });

      const existingUsers = Array.from(room)
        .filter((id) => id !== socket.id)
        .map((id) => ({
          socketId: id,
          userName: users.get(id)?.userName || "User",
        }));

      if (existingUsers.length > 0) {
        socket.emit("existing-users", { users: existingUsers });
      }

      socket.to(roomId).emit("user-connected", {
        socketId: socket.id,
        userId,
        userName,
      });
    });

    socket.on("offer", ({ offer, to }) => {
      io.to(to).emit("offer", {
        offer,
        from: socket.id,
      });
    });

    socket.on("answer", ({ answer, to }) => {
      io.to(to).emit("answer", {
        answer,
        from: socket.id,
      });
    });

    socket.on("ice-candidate", ({ candidate, to }) => {
      io.to(to).emit("ice-candidate", {
        candidate,
        from: socket.id,
      });
    });

    socket.on("disconnect", () => {
      const user = users.get(socket.id);
      if (!user) return;

      const { roomId } = user;

      if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        room.delete(socket.id);

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
