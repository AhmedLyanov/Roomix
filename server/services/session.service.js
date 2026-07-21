import Session from "../models/Session.model.js";

export async function createSession({ roomId, ownerId, ownerName, language }) {
  return await Session.findOneAndUpdate(
    {
      roomId,
      endedAt: { $exists: false },
    },
    {
      $setOnInsert: {
        roomId,
        ownerId,
        ownerName,
        startedAt: new Date(),
        participants: [
          {
            userId: ownerId,
            userName: ownerName,
            language,
            joinedAt: new Date(),
          },
        ],
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );
}

export async function joinParticipant({ roomId, userId, userName, language }) {
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
    language,
    joinedAt: new Date(),
  });

  await session.save();
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
