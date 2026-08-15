import mongoose from "mongoose";

const { Schema } = mongoose;

const RoomMessageSchema = new Schema(
  {
    roomId: {
      type: String,
      required: true,
      index: true,
    },
    senderId: {
      type: String,
      required: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    senderAvatar: {
      type: String,
      default: "",
    },
    text: {
      type: String,
      default: "",
      trim: true,
    },
    type: {
      type: String,
      enum: ["text", "system", "image", "file"],
      default: "text",
    },
    file: {
      originalName: String,
      storedName: String,
      mimeType: String,
      size: Number,
      url: String,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.models.RoomMessage ||
  mongoose.model("RoomMessage", RoomMessageSchema);