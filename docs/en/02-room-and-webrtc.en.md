# Merriweather — Room and WebRTC Architecture

## 1. Purpose of This Document

This document explains how a user enters a Merriweather room, how realtime room state is maintained, and how two or more browsers establish live audio/video communication.

The most important architectural distinction is:

```text
Socket.IO
    → signaling and realtime application events

WebRTC
    → actual audio/video transport
```

Socket.IO does not carry the final video stream between participants. It carries the information required for browsers to negotiate a WebRTC connection.

---

## 2. High-Level Flow

A simplified room flow looks like this:

```text
User opens /room/:roomId
        ↓
Browser requests MediaStream
        ↓
Client creates Socket.IO connection
        ↓
Client emits "join-room"
        ↓
Fastify registers the participant
        ↓
Backend creates or retrieves Session
        ↓
Participants discover each other
        ↓
Frontend creates simple-peer instances
        ↓
WebRTC offer / answer / ICE exchange
        ↓
WebRTC connection established
        ↓
Remote MediaStream received
        ↓
Remote video rendered in the UI
```

At the same time, Socket.IO continues to handle application-level realtime events such as:

```text
camera:update
mic:update
language:update
chat:send
subtitle
user-connected
user-disconnected
```

---

## 3. Room and Session Are Different Concepts

Merriweather has both a realtime room and a persistent session.

### Room

A room is the temporary realtime environment.

The backend keeps currently connected participants in memory:

```text
rooms
  Map<roomId, Map<socketId, participant>>
```

This state exists while users are connected.

### Session

A session is the persistent representation of a meeting.

It is stored in MongoDB and contains information such as:

- room ID;
- owner;
- participants;
- start time;
- end time;
- duration.

Therefore:

```text
Room
    = current realtime state

Session
    = persistent historical record
```

This separation is important because a room can disappear from memory while its session remains available in the database.

---

## 4. Client-Side Room Architecture

The room functionality is separated into several React hooks.

Conceptually:

```text
useMedia
    ↓
MediaStream

usePeer
    ↓
WebRTC peer connections

useSocket
    ↓
Socket.IO + signaling

useRoomSession
    ↓
orchestration
```

The goal is to avoid putting all realtime logic into a single React component.

Each hook has a specific responsibility.

---

## 5. Media Acquisition

Before the realtime socket is initialized, the application needs a local media stream.

The browser requests access to:

```text
camera
microphone
```

The result is a `MediaStream`.

Conceptually:

```text
navigator.mediaDevices.getUserMedia(...)
                    ↓
              MediaStream
                    ↓
        ┌───────────┴───────────┐
        ↓                       ↓
    WebRTC peers          audio processing
```

The same local media source can therefore participate in two different systems:

```text
MediaStream
   ├── WebRTC
   │    └── live communication
   │
   └── audio processing
        └── speech translation
```

The important point is that these are different processing paths.

---

## 6. Socket Initialization

The client creates a Socket.IO connection using the configured signaling URL.

The socket is configured with:

```text
path: "/ws"
transports: ["websocket"]
```

Once the socket connects, the client sends:

```text
join-room
```

with information such as:

```text
roomId
userId
userName
nativeLanguage
userAvatar
```

This allows the backend to associate the socket connection with an application user.

---

## 7. Preventing Duplicate Initialization

The client keeps:

```text
initializedRef
```

to prevent the realtime connection from being initialized more than once during the lifecycle of the hook.

This is particularly important in development environments where React may execute lifecycle behavior more aggressively.

The conceptual guard is:

```text
if already initialized
    → do nothing

otherwise
    → initialize socket
```

When the socket is cleaned up, the reference is reset.

---

## 8. Backend Socket Connection

The backend creates a Socket.IO server on top of the Fastify server.

The server maintains two important Maps:

```text
rooms
users
```

### rooms

Tracks users currently inside each room.

Conceptually:

```text
rooms
└── roomId
    ├── socketA → participant
    ├── socketB → participant
    └── socketC → participant
```

### users

Maps socket IDs to application-level user information.

Conceptually:

```text
users
└── socketId
    ├── userId
    ├── userName
    ├── roomId
    ├── nativeLanguage
    └── userAvatar
```

This allows later websocket events to determine who sent them without repeatedly reconstructing the user's identity.

---

## 9. Joining a Room

When the backend receives:

```text
join-room
```

it performs several operations.

First:

```text
socket.join(roomId)
```

The Socket.IO connection becomes a member of the room.

Then the backend creates a participant object containing:

```text
socketId
userId
userName
nativeLanguage
cameraEnabled
microphoneEnabled
userAvatar
```

The participant is stored inside the room's in-memory Map.

The user is also stored in the global `users` Map.

---

## 10. Discovering Existing Participants

The server checks which users are already inside the room.

If existing participants are found, the newly connected socket receives:

```text
existing-users
```

with information about those participants.

The new client then creates peers for those users.

Conceptually:

```text
New user
   ↓
existing-users
   ↓
for each existing user
   ↓
createPeer(socketId, true)
```

The `true` value means the new client acts as the WebRTC initiator for that peer connection.

---

## 11. Notifying Existing Participants

The backend also notifies users already inside the room.

They receive:

```text
user-connected
```

with information about the newly connected participant.

Those clients create their peer connection with:

```text
createPeer(socketId, false)
```

The distinction is important:

```text
New participant
    → initiator = true

Existing participant
    → initiator = false
```

This gives the connection a clear negotiation direction.

---

## 12. WebRTC Peer Creation

Merriweather uses `simple-peer` as an abstraction over the lower-level WebRTC APIs.

A peer represents a WebRTC connection between two participants.

Conceptually:

```text
Participant A
      │
      │ Peer A
      │
      ├──────── WebRTC ────────┐
      │                       │
      │                    Peer B
      │                       │
Participant B
```

The frontend stores active peers in a `Map`.

Conceptually:

```text
peersRef
└── socketId → Peer.Instance
```

This allows the application to quickly find the WebRTC peer associated with a participant.

---

## 13. WebRTC Signaling

WebRTC requires signaling before browsers can establish a media connection.

Merriweather uses Socket.IO as the signaling transport.

The main signaling messages are:

```text
offer
answer
ice-candidate
```

The flow is:

```text
Peer A
   │
   │ offer
   ▼
Socket.IO
   │
   ▼
Peer B
   │
   │ answer
   ▼
Socket.IO
   │
   ▼
Peer A
```

ICE candidates are exchanged during the same general negotiation process.

---

## 14. Offer

The initiator creates an SDP offer.

`simple-peer` emits a signal containing that offer.

The client sends it through Socket.IO:

```text
offer
```

The backend does not need to understand the SDP itself.

It simply forwards the signaling payload to the target socket.

Conceptually:

```text
Peer A
   ↓
Socket.IO client
   ↓
Fastify Socket.IO server
   ↓
Peer B
```

---

## 15. Answer

The receiving peer processes the offer.

It generates an answer.

The answer travels back through the same signaling channel:

```text
Peer B
   ↓
Socket.IO
   ↓
Peer A
```

The peers can now continue establishing the WebRTC connection.

---

## 16. ICE Candidates

WebRTC also needs to discover possible network paths between participants.

These are represented by ICE candidates.

Merriweather forwards:

```text
ice-candidate
```

through Socket.IO.

The conceptual flow is:

```text
Peer A
   ↓
ICE candidate
   ↓
Socket.IO
   ↓
Peer B
```

and in the opposite direction as required.

Socket.IO therefore acts as the signaling channel, not the media channel.

---

## 17. Where the Video Actually Travels

This is one of the most important concepts to understand when explaining the project.

After WebRTC negotiation succeeds:

```text
Browser A
    │
    │ audio/video
    │
    ▼
  WebRTC
    │
    ▼
Browser B
```

The video does not continuously travel through:

```text
Fastify
Socket.IO
MongoDB
```

Those systems are involved in signaling or persistence, not in carrying the normal live media stream.

A useful mental model is:

```text
Socket.IO
    = "How do these browsers find and negotiate each other?"

WebRTC
    = "Now send the media directly."
```

---

## 18. Receiving the Remote Stream

When the WebRTC peer emits a remote stream event, the frontend receives a `MediaStream`.

That stream is associated with the corresponding participant.

The room UI can then attach the stream to a video element.

Conceptually:

```text
WebRTC Peer
     ↓
remote MediaStream
     ↓
participant state
     ↓
video element
```

The user therefore sees the remote participant's camera feed.

---

## 19. Participant State

The application maintains participant UI state separately from the actual media stream.

Participant state can contain values such as:

```text
userName
userAvatar
cameraEnabled
microphoneEnabled
```

This distinction matters.

For example:

```text
cameraEnabled = false
```

is an application state value.

It does not itself represent a video stream.

The actual stream is handled by WebRTC.

---

## 20. Camera State Synchronization

When a user changes the camera state, the client emits:

```text
camera:update
```

The backend finds the participant associated with the socket and updates the in-memory participant state.

The server then broadcasts:

```text
camera:update
```

to the other participants.

The receiving clients update their local participant state.

Conceptually:

```text
User A
  ↓
camera:update
  ↓
Server
  ↓
Other participants
  ↓
UI updates
```

The same general pattern is used for microphone state.

---

## 21. Microphone State Synchronization

The client emits:

```text
mic:update
```

The server updates the participant's microphone state and broadcasts the change.

This allows other clients to display the correct microphone status.

Again, this is an application-level event.

It is separate from the actual WebRTC audio track.

---

## 22. Language State Synchronization

The client can also emit:

```text
language:update
```

with the user's current language.

The server updates both:

```text
users
rooms
```

runtime state and persists the participant's language into the active Session.

This value becomes important for the translation pipeline because the system needs to know:

```text
Who speaks what language?
Who needs translation?
```

Merriweather currently focuses on:

```text
Russian ↔ English
```

---

## 23. Chat and WebRTC Are Separate

Text chat uses Socket.IO:

```text
chat:send
    ↓
Fastify
    ↓
MongoDB
    ↓
chat:new
```

This is completely different from the WebRTC media path.

Therefore:

```text
Chat message
    → Socket.IO + MongoDB

Video/audio
    → WebRTC
```

This separation prevents the realtime communication architecture from becoming one giant undifferentiated transport layer.

---

## 24. Disconnect Handling

When a socket disconnects, the backend:

1. cleans up speech-processing state;
2. finds the associated user;
3. marks the participant as having left;
4. removes the socket from the room;
5. finishes the Session if the room becomes empty;
6. notifies remaining participants;
7. removes the socket from the `users` Map.

Conceptually:

```text
disconnect
   ↓
leaveParticipant
   ↓
remove socket
   ↓
room empty?
   ├── no → keep session active
   └── yes
         ↓
      finishSession
```

This connects realtime connection lifecycle with persistent session lifecycle.

---

## 25. Session Lifecycle and WebSocket Lifecycle

The session lifecycle is tightly connected to room membership.

A typical flow is:

```text
First socket joins
        ↓
createSession()
        ↓
SESSION_STARTED
        ↓
Additional sockets join
        ↓
PARTICIPANT_JOINED
        ↓
Realtime communication
        ↓
Sockets disconnect
        ↓
Participants leave
        ↓
Room becomes empty
        ↓
finishSession()
```

This is why the WebSocket layer is not only responsible for communication.

It also acts as the trigger for the session lifecycle.

---

## 26. Mesh Topology

The current architecture is effectively a mesh network.

For three participants:

```text
        A
       /       /        B─────C
```

Each participant can have a direct WebRTC connection with the other participants.

For two users:

```text
A ───── B
```

For three:

```text
A ───── B
 \     /
  \   /
    C
```

This is simple and works well for a portfolio-scale realtime application.

However, the number of peer connections grows as the number of participants increases.

For `N` participants, a full mesh requires approximately:

```text
N × (N - 1) / 2
```

peer connections across the room.

This is one reason production-scale conferencing systems commonly use an SFU architecture instead.

---

## 27. Why an SFU Is Not Currently Required

Merriweather is a portfolio project rather than a large production conferencing platform.

A mesh topology has several advantages here:

- simpler architecture;
- no media server required;
- direct browser-to-browser media;
- easier to understand;
- fewer infrastructure dependencies.

The trade-off is scalability.

A large number of participants would increase CPU, bandwidth, and connection management requirements on each browser.

---

## 28. Cleanup on the Client

When the room hook is unmounted or the connection is intentionally closed, the frontend:

```text
stops AudioSender
disconnects Socket.IO
resets initialization state
```

WebRTC peers are also removed as participants disconnect.

This prevents stale realtime connections from remaining after the user leaves the room.

---

## 29. Important Architectural Boundaries

The room system is easier to understand if the responsibilities are kept separate.

```text
Media acquisition
    → browser MediaStream

WebRTC
    → audio/video transport

simple-peer
    → WebRTC abstraction

Socket.IO
    → signaling + realtime events

Fastify
    → server-side orchestration

MongoDB
    → persistent data

React state
    → UI representation
```

A change in one layer should not require rewriting the entire realtime system.

---

## 30. The Complete Connection Sequence

Putting everything together:

```text
1. User opens room
        ↓
2. Browser obtains MediaStream
        ↓
3. Client initializes Socket.IO
        ↓
4. Client emits join-room
        ↓
5. Server adds socket to room
        ↓
6. Server creates/retrieves Session
        ↓
7. Server identifies existing participants
        ↓
8. New user receives existing-users
        ↓
9. Existing users receive user-connected
        ↓
10. Clients create simple-peer instances
        ↓
11. Initiator generates offer
        ↓
12. Offer travels through Socket.IO
        ↓
13. Receiver generates answer
        ↓
14. Answer travels through Socket.IO
        ↓
15. ICE candidates are exchanged
        ↓
16. WebRTC connection is established
        ↓
17. MediaStream flows between browsers
        ↓
18. Socket.IO continues handling application events
        ↓
19. Participants disconnect
        ↓
20. Session is eventually finished
```

---

## 31. What to Explain During a Project Demonstration

If asked how the video call works, the shortest technically correct explanation is:

> “The browser obtains a local MediaStream and creates a WebRTC peer for each remote participant. Socket.IO is used only as the signaling channel to exchange offers, answers, and ICE candidates. Once the WebRTC connection is negotiated, the actual audio and video are transported through WebRTC rather than through Socket.IO.”

If asked why Socket.IO is needed:

> “WebRTC handles media transport, but the peers still need a signaling mechanism to exchange the information required to establish the connection. In Merriweather, Socket.IO provides that signaling layer.”

If asked how a new participant appears:

> “The new socket joins the Socket.IO room. Existing participants are returned to the new client through `existing-users`, while existing clients receive `user-connected`. The clients then create the required WebRTC peers and start signaling.”

If asked how the session is persisted:

> “The realtime room exists in memory, while the Session is stored in MongoDB. The WebSocket lifecycle triggers session creation, participant updates, and session completion.”

---

## 32. Key Takeaways

The core architecture can be reduced to five ideas:

```text
1. MediaStream
   Browser captures audio/video.

2. WebRTC
   Browsers transport live media.

3. Socket.IO
   Browsers exchange signaling and application events.

4. Fastify
   Coordinates realtime state and backend services.

5. MongoDB
   Stores persistent session history.
```

The architecture deliberately separates realtime transport from persistence:

```text
                 Merriweather
                      │
          ┌───────────┴───────────┐
          │                       │
      Realtime                 Persistence
          │                       │
   ┌──────┴──────┐          ┌─────┴─────┐
   │             │          │           │
Socket.IO     WebRTC     Session    RoomMessage
   │             │          │
signaling      media    SessionAction
events
```

Understanding this separation is the key to understanding the entire room architecture.
