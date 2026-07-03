import { Webhook } from "svix";
import User from "../../models/User.js";

export default async function clerkWebhook(fastify) {
  fastify.post("/api/webhooks/clerk", async (req, reply) => {
    const SIGNING_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!SIGNING_SECRET) {
      return reply.code(500).send({ error: "Missing CLERK_WEBHOOK_SECRET" });
    }

    const svix_id = req.headers["svix-id"];
    const svix_timestamp = req.headers["svix-timestamp"];
    const svix_signature = req.headers["svix-signature"];

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return reply.code(400).send({ error: "Missing svix headers" });
    }

    const wh = new Webhook(SIGNING_SECRET);

    let event;

    try {
      event = wh.verify(req.body, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      });
    } catch (err) {
      return reply.code(400).send({ error: "Invalid signature" });
    }

    const { type, data } = event;

    if (type === "user.created" || type === "user.updated") {
      await User.findOneAndUpdate(
        { clerkId: data.id },
        {
          clerkId: data.id,
          email: data.email_addresses?.[0]?.email_address,
          username: data.username || data.first_name || "user",
          avatar: data.image_url,
        },
        { upsert: true, new: true }
      );
    }

    if (type === "user.deleted") {
      await User.findOneAndDelete({ clerkId: data.id });
    }

    return reply.send({ success: true });
  });
}