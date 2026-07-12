import mongoose from "mongoose";

const { Schema } = mongoose;

const SessionSchema = new Schema(
  {
    roomId: {
      type: String,
      required: true,
    },

    ownerId: {
      type: String,
      required: true,
    },

    ownerName: {
      type: String,
      required: true,
    },

    startedAt: {
      type: Date,
      default: Date.now,
    },

    endedAt: Date,

    duration: {
      type: Number,
      default: 0,
    },

    participants: [
      {
        userId: {
          type: String,
          required: true,
        },

        userName: {
          type: String,
          required: true,
        },

        language: {
          type: String,
          required: true,
          default: "en",
        },

        joinedAt: {
          type: Date,
          default: Date.now,
        },

        leftAt: Date,
      },
    ],

    messagesCount: {
      type: Number,
      default: 0,
    },

    actionsCount: {
      type: Number,
      default: 0,
    },

    recordingsCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

export default (
  mongoose.models.Session ||
  mongoose.model("Session", SessionSchema)
);