import mongoose from "mongoose";

const sessionActionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },

    type: {
      type: String,
      enum: [
        "SESSION_STARTED",
        "SESSION_ENDED",
        "PARTICIPANT_JOINED",
        "PARTICIPANT_LEFT",
        "FILE_UPLOADED",
        "MESSAGE_SENT",
        "SCREEN_SHARED",
      ],
      required: true,
    },

   userId: {
  type: String,
},

    metadata: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);


export default mongoose.model(
  "SessionAction",
  sessionActionSchema
);