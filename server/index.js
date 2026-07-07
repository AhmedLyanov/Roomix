import "dotenv/config";

import path from "node:path";
import { fileURLToPath } from "node:url";

import AutoLoad from "@fastify/autoload";
import cors from "@fastify/cors";

import connectDatabase from "./config/db.js";
import clerkWebhook from "./routes/webhooks/clerk.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function app(fastify, opts) {
  await fastify.register(cors, {
    origin: "http://localhost:3000",
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
  await connectDatabase();

  fastify.register(clerkWebhook);

  fastify.register(AutoLoad, {
    dir: path.join(__dirname, "plugins"),
    options: opts,
  });

  fastify.register(AutoLoad, {
    dir: path.join(__dirname, "routes"),
    options: opts,
  });
}

export const options = {};
