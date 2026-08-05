import Session from "../models/Session.model.js";
import SessionAction from "../models/SessionAction.model.js";


async function createSessionAction({
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
  return SessionAction.find({
    sessionId,
  }).sort({
    createdAt: 1,
  });
}

export async function createSession({
  roomId,
  ownerId,
  ownerName,
  ownerAvatar,
  language,
}) {
  const existingSession = await Session.findOne({
    roomId,
    endedAt: { $exists: false },
  });

  if (existingSession) {
    return existingSession;
  }

  const session = await Session.create({
    roomId,
    ownerId,
    ownerName,
    startedAt: new Date(),
    participants: [
      {
        userId: ownerId,
        userName: ownerName,
        userAvatar: ownerAvatar,
        language,
        joinedAt: new Date(),
      },
    ],
  });

  await createSessionAction({
    sessionId: session._id,
    type: "SESSION_STARTED",
    userId: ownerId,
    metadata: {
      ownerName,
    },
  });

  return session;
}

export async function joinParticipant({
  roomId,
  userId,
  userName,
  avatar,
  language,
}) {
  const session = await Session.findOne({
    roomId,
    endedAt: { $exists: false },
  });

  if (!session) return;

  const exists = session.participants.some(
    (participant) => participant.userId === userId,
  );

  if (exists) return;

  session.participants.push({
    userId,
    userName,
    userAvatar: avatar,
    language,
    joinedAt: new Date(),
  });

  await session.save();
  
  await createSessionAction({
    sessionId: session._id,
    type: "PARTICIPANT_JOINED",
    userId,
    metadata: {
      userName,
    },
  });

  return session;
}

export async function updateParticipantLanguage({ roomId, userId, language }) {
  const session = await Session.findOne({
    roomId,
    endedAt: { $exists: false },
  });

  if (!session) return;

  const participant = session.participants.find(
    (participant) => participant.userId === userId,
  );

  if (!participant) return;

  participant.language = language;

  await session.save();

  return session;
}

export async function leaveParticipant({ roomId, userId }) {
  const session = await Session.findOne({
    roomId,
    endedAt: { $exists: false },
  });

  if (!session) return;

  const participant = session.participants.find(
    (participant) => participant.userId === userId,
  );

  if (!participant) return;

  participant.leftAt = new Date();

  await session.save();

  return session;
}

export async function finishSession(roomId) {
  const session = await Session.findOne({
    roomId,
    endedAt: { $exists: false },
  });

  if (!session) return;

  session.endedAt = new Date();

  session.duration = Math.floor(
    (session.endedAt.getTime() - session.startedAt.getTime()) / 1000,
  );

  await session.save();

  return session;
}

export async function getSessions(userId) {
  return Session.find({
    ownerId: userId,
  }).sort({
    startedAt: -1,
  });
}

export async function getSession(sessionId) {
  return Session.findById(sessionId);
}

export async function deleteSession(sessionId) {
  return Session.findByIdAndDelete(sessionId);
}