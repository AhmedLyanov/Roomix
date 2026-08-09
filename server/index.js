import "dotenv/config";

import path from "node:path";
import { fileURLToPath } from "node:url";

import AutoLoad from "@fastify/autoload";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";

import connectDatabase from "./config/db.js";
import clerkWebhook from "./routes/webhooks/clerk.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function app(fastify, opts) {
  await fastify.register(cors, {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, done) => {
      done(null, body);
    },
  );

  await fastify.register(fastifyStatic, {
    root: path.join(__dirname, "uploads"),
    prefix: "/uploads/",
  });

  await connectDatabase();

  await fastify.register(clerkWebhook);

  await fastify.register(AutoLoad, {
    dir: path.join(__dirname, "plugins"),
    options: opts,
  });

  await fastify.register(AutoLoad, {
    dir: path.join(__dirname, "routes"),
    options: opts,
  });
}

export const options = {};
