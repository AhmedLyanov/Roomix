import mongoose from "mongoose";

export default async function connectDatabase() {
  if (!process.env.MONGO_URI) {
    console.warn("⚠️ MONGO_URI is not set. Skipping MongoDB connection.");
    return;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection failed");
    console.error(error);
  }
}
