import SessionAction from "../models/SessionAction.model.js";

export async function createSessionAction({
  sessionId,
  type,
  userId,
  metadata = {},
}) {
  try {
    const action = await SessionAction.create({
      sessionId,
      type,
      userId,
      metadata,
    });

    return action;
  } catch (error) {
    console.error("Failed to create session action:", error);
    throw error;
  }
}



export async function getSessionActions(sessionId) {
  const actions = await SessionAction.find({
    sessionId,
  }).sort({
    createdAt: 1,
  });
  return actions;
}