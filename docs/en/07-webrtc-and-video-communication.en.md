# Roomix— WebRTC and Video Communication

## 1. Purpose

Video communication is one of the core realtime features of Roomix.

A user enters a room, grants the browser access to the camera and microphone, and the application creates WebRTC connections with other participants and receives their remote `MediaStream` objects.

The main architectural separation is:

```text
Socket.IO
    → signaling and realtime application events

WebRTC
    → actual audio/video transport
```

Socket.IO does not carry the actual video stream. It is used as a signaling transport through which browsers exchange the information required to establish a WebRTC connection.

After successful WebRTC negotiation:

```text
Browser A <====================> Browser B
             MediaStream
           audio + video
```

---

## 2. Technologies

The video communication layer uses:

- browser `MediaStream`;
- WebRTC;
- `simple-peer`;
- Socket.IO client/server;
- STUN for ICE network discovery;
- React hooks for room lifecycle, peers, and remote streams.

The peer is conceptually created as:

```ts
new Peer({
  initiator,
  trickle: true,
  stream,
  config: {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
    ],
  },
});
```

This means:

- the local `MediaStream` is attached to each peer;
- trickle ICE is enabled;
- STUN is configured;
- TURN is not configured in the current implementation.

---

## 3. Main frontend modules

The WebRTC logic is distributed across several hooks.

### `useMedia`

Obtains the local `MediaStream`:

```text
camera track
microphone track
       |
       v
   MediaStream
```

The stream is used by two independent branches:

```text
MediaStream
   |
   +--> simple-peer
   |       |
   |       v
   |    WebRTC media
   |
   +--> AudioSender
           |
           v
       audio-chunk
```

Video communication and realtime translation therefore share the same audio source but process it through different pipelines.

### `usePeer`

Responsible for WebRTC peer connections.

Main runtime structures:

```text
peersRef
remoteStreamsRef
remoteVideos
```

`peersRef`:

```text
socketId → Peer.Instance
```

`remoteStreamsRef`:

```text
socketId → MediaStream
```

`remoteVideos` is React state used by the UI to trigger renders.

### `useSocket`

Manages Socket.IO and signaling:

- `join-room`;
- `existing-users`;
- `user-connected`;
- `offer`;
- `answer`;
- `ice-candidate`;
- `user-disconnected`.

### `useRoomSession`

Combines these pieces:

```text
useMedia
    |
    v
usePeer
    |
    v
useSocket
    |
    v
useRoomSession
```

The room component works with a higher-level API:

```text
stream
remoteVideos
participants
disconnect
```

---

## 4. User enters a room

The room URL is:

```text
/room/:roomId
```

The flow begins with:

```text
Browser
   ↓
useMedia()
   ↓
MediaStream
   ↓
usePeer(stream)
   ↓
useSocket()
   ↓
Socket.IO connect
```

The socket is created conceptually through:

```ts
io(process.env.NEXT_PUBLIC_SIGNALING_URL!, {
  path: "/ws",
  transports: ["websocket"],
  forceNew: true,
});
```

After connecting, the client sends:

```ts
socket.emit("join-room", {
  roomId,
  userId,
  userName,
  nativeLanguage,
  userAvatar,
});
```

The backend then:

1. adds the socket to the Socket.IO room;
2. stores the runtime participant;
3. sends the new participant the existing users;
4. notifies existing participants;
5. creates or retrieves the active Session.

---

## 5. Backend runtime state

The WebSocket server maintains two main `Map` structures.

### `rooms`

Conceptually:

```text
rooms
  |
  +-- roomId
       |
       +-- socketId
            |
            +-- participant
```

A participant contains:

```text
socketId
userId
userName
nativeLanguage
userAvatar
cameraEnabled
microphoneEnabled
```

### `users`

The second Map associates a socket with application-level user information:

```text
users
  |
  +-- socketId
       |
       +-- userId
       +-- userName
       +-- roomId
       +-- nativeLanguage
       +-- userAvatar
```

Responsibilities:

```text
rooms
  → participants in a specific room

users
  → information associated with a socket
```

`users` is especially useful for quickly determining the user associated with a socket ID during later events.

---

## 6. Discovering existing participants

When a new user enters, the backend creates an:

```text
existingUsers
```

list and sends:

```text
existing-users
```

to the new client.

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

`true` means that the new client becomes the WebRTC initiator for that peer.

---

## 7. Notifying existing participants

At the same time, the backend sends existing participants:

```text
user-connected
```

They create:

```text
createPeer(socketId, false)
```

Therefore:

```text
New participant
    → initiator = true

Existing participant
    → initiator = false
```

This gives each pair of peers a clear negotiation direction.

---

## 8. Mesh topology

In the current implementation, every participant creates a separate `simple-peer` for every other participant.

For three users:

```text
Ahmed ↔ Ali
Ahmed ↔ John
Ali   ↔ John
```

Ahmed has:

```text
Ahmed
  |
  +-- Peer(Ali)
  |
  +-- Peer(John)
```

Therefore the current architecture is a mesh-like peer-to-peer topology rather than an SFU/MCU architecture.

The number of connections grows with the number of participants:

```text
N × (N - 1) / 2
```

For example:

```text
2 users → 1 connection
3 users → 3 connections
4 users → 6 connections
5 users → 10 connections
```

For small rooms this is simple and sufficient.

For large conferences, this approach scales poorly, which is why production systems commonly use an SFU.

---

## 9. `peersRef`

Peer connections are stored on the frontend in:

```ts
useRef<Map<string, Peer.Instance>>(new Map());
```

Key:

```text
socketId
```

Value:

```text
Peer.Instance
```

Conceptually:

```text
peersRef
  |
  +-- socketA → Peer
  +-- socketB → Peer
  +-- socketC → Peer
```

`useRef` is appropriate for WebRTC objects because changes to a peer instance should not themselves trigger a React render.

UI state is stored separately.

---

## 10. Creating a peer

The main operation is conceptually:

```ts
createPeer(socketId, initiator);
```

First, the local stream is checked:

```ts
if (!stream) return null;
```

Then an existing peer is checked:

```ts
if (peersRef.current.has(socketId)) {
  return peersRef.current.get(socketId)!;
}
```

This prevents multiple peer instances from being created for the same socket.

The peer is then created with:

```ts
new Peer({
  initiator,
  trickle: true,
  stream,
  config: {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
    ],
  },
});
```

---

## 11. What `initiator` means

`initiator` determines which side starts the WebRTC negotiation.

The new participant receives:

```text
existing-users
```

and creates:

```ts
createPeer(socketId, true);
```

The existing participant receives:

```text
user-connected
```

and creates:

```ts
createPeer(socketId, false);
```

So:

```text
New client
   |
   +--> initiator = true

Existing client
   |
   +--> initiator = false
```

This prevents both sides from independently attempting to start the same negotiation flow.

---

## 12. Local `MediaStream`

The media source is obtained through the browser Media API:

```text
getUserMedia()
      |
      v
 MediaStream
```

The stream then feeds two branches:

```text
                    MediaStream
                         |
              +----------+----------+
              |                     |
              v                     v
        simple-peer            AudioSender
              |                     |
              v                     v
        WebRTC media            audio-chunk
```

The first branch handles communication.

The second branch is used by realtime translation.

This is one of the most important architectural details in the project.

---

## 13. Why signaling is required

WebRTC does not mean that two browsers automatically know how to connect.

Before establishing the media connection, they must exchange negotiation information.

Roomixuses Socket.IO for this purpose.

The main signaling events are:

```text
offer
answer
ice-candidate
```

Socket.IO is the signaling transport.

It is not the media transport.

---

## 14. Offer

The initiator generates WebRTC signaling data.

`simple-peer` emits:

```ts
peer.on("signal", ...)
```

When the signal contains an offer, the frontend sends:

```ts
socket.emit("offer", {
  offer: signal.data,
  to: signal.to,
});
```

The backend routes it:

```ts
socket.on("offer", ({ offer, to }) => {
  io.to(to).emit("offer", {
    offer,
    from: socket.id,
  });
});
```

The backend does not interpret the SDP.

It only routes the signaling payload.

Flow:

```text
Peer A
   ↓
Socket.IO client
   ↓
Fastify + Socket.IO
   ↓
Peer B
```

---

## 15. Answer

Browser B receives the offer:

```ts
socket.on("offer", ({ offer, from }) => {
  let peer = peersRef.current.get(from);

  if (!peer) {
    peer = createPeer(from, false);
  }

  peer?.signal(offer);
});
```

`simple-peer` processes the offer and generates an answer.

The frontend sends:

```ts
socket.emit("answer", {
  answer: signal.data,
  to: signal.to,
});
```

The backend routes:

```ts
io.to(to).emit("answer", {
  answer,
  from: socket.id,
});
```

Browser A receives the answer:

```ts
socket.on("answer", ({ answer, from }) => {
  peersRef.current.get(from)?.signal(answer);
});
```

---

## 16. ICE candidates

Offer/answer alone is not enough.

Browsers must find a possible network path between one another.

This is handled by ICE.

In `simple-peer`:

```text
trickle: true
```

means ICE candidates can be exchanged incrementally as they are discovered.

The frontend sends:

```text
ice-candidate
```

The backend forwards it to the target socket.

The receiver passes it back into the peer:

```ts
peersRef.current.get(from)?.signal(candidate);
```

Simplified:

```text
Offer
  ↓
Answer
  ↓
ICE candidates
  ↓
WebRTC connection
```

In reality, signaling messages can arrive at different stages of negotiation.

---

## 17. STUN

The peer configuration contains:

```ts
iceServers: [
  {
    urls: "stun:stun.l.google.com:19302",
  },
];
```

STUN helps the browser obtain network information needed to find a possible route between peers.

The current implementation has:

```text
STUN configured
TURN not configured
```

This is a limitation.

In some NAT/firewall environments, direct connectivity may fail. TURN can act as a relay when a direct peer-to-peer path cannot be established.

Therefore the documentation should not claim that Roomixhas a complete TURN infrastructure when the source code does not demonstrate it.

---

## 18. Where the video actually travels

This is one of the most important questions during a project demonstration.

After negotiation:

```text
Browser A
    |
    | audio/video
    v
  WebRTC
    |
    v
Browser B
```

The video does not continuously travel through:

```text
Fastify
Socket.IO
MongoDB
```

Those systems are involved in signaling, application events, and persistence.

The useful mental model is:

```text
Socket.IO
    =
"How did the browsers agree to connect?"

WebRTC
    =
"Now transfer the media."
```

---

## 19. Receiving the remote stream

After the WebRTC connection is established, the peer receives the remote stream:

```ts
peer.on("stream", (remoteStream) => {
  remoteStreamsRef.current.set(socketId, remoteStream);

  setRemoteVideos(new Map(remoteStreamsRef.current));
});
```

Flow:

```text
Remote Peer
    |
    | WebRTC media
    v
remoteStream
    |
    v
remoteStreamsRef
    |
    v
remoteVideos
    |
    v
React UI
```

The UI can then attach the stream to a `<video>` element.

---

## 20. Why `remoteStreamsRef` and `remoteVideos` are separate

`remoteStreamsRef` stores runtime `MediaStream` objects.

These are mutable browser objects, so changing them should not itself force React to render.

However, the UI must know when a stream appears or disappears.

Therefore the application creates a new `Map`:

```ts
setRemoteVideos(new Map(remoteStreamsRef.current));
```

The separation is:

```text
Ref
  |
  +-- runtime WebRTC objects

State
  |
  +-- data required by the UI
```

This is especially useful for long-lived browser objects such as WebRTC peers and `MediaStream` objects.

---

## 21. Disconnect handling

When a participant disconnects, the backend sends:

```text
user-disconnected
```

The frontend calls:

```text
removePeer(socketId)
```

and removes the participant from UI state.

`removePeer` should clean up:

1. the WebRTC peer;
2. the peer reference;
3. the remote `MediaStream`;
4. the participant UI state.

Conceptually:

```text
disconnect
    |
    +--> destroy peer
    |
    +--> delete peer
    |
    +--> delete remote stream
    |
    +--> update UI
```

This prevents stale realtime objects from accumulating.

---

## 22. Peer errors and close events

The peer layer also handles:

```text
peer.on("close")
peer.on("error")
```

Both cases use the same cleanup path.

This matters because a WebRTC connection can terminate without a normal socket disconnect.

---

## 23. Complete flow: first participant

Suppose Ahmed opens:

```text
/room/123
```

The sequence is:

```text
1. Browser opens room
        ↓
2. useMedia()
        ↓
3. MediaStream obtained
        ↓
4. usePeer(stream)
        ↓
5. useSocket()
        ↓
6. Socket.IO connect
        ↓
7. join-room
        ↓
8. Backend adds socket to room
        ↓
9. createSession()
        ↓
10. existing users are sent to Ahmed
```

If no other users are present, WebRTC negotiation is not required yet.

---

## 24. Complete flow: second participant

Suppose Ahmed is already in the room.

Ali joins.

The backend does:

```text
join-room(Ali)
      |
      +--> existing-users → Ali
      |
      +--> user-connected → Ahmed
```

Ali:

```text
existing-users
      ↓
createPeer(Ahmed, true)
```

Ahmed:

```text
user-connected
      ↓
createPeer(Ali, false)
```

Signaling then begins:

```text
Ali Peer
    |
    | offer
    v
Socket.IO
    |
    | offer
    v
Ahmed Peer
    |
    | answer
    v
Socket.IO
    |
    v
Ali Peer
```

ICE candidates are exchanged in parallel as required.

After negotiation:

```text
Ali MediaStream
      |
      v
Ahmed remoteStream
```

and the reverse direction is established as well.

---

## 25. Complete signaling flow

For two participants:

```text
                  Socket.IO
               signaling server
                /            \
               /              \
          Browser A        Browser B
              |                |
              +--- WebRTC ------+
                   media
```

Signaling:

```text
A → offer → Server → B
A ← answer ← Server ← B
A ↔ ICE candidates ↔ Server ↔ B
```

Media:

```text
A ======================= B
          WebRTC media
```

The central rule is:

```text
Socket.IO = signaling/events
WebRTC    = actual media
```

---

## 26. Camera and microphone state

The room has dedicated events:

```text
camera:update
mic:update
```

The frontend sends:

```ts
socket.emit("camera:update", {
  roomId,
  userId,
  enabled,
});
```

and:

```ts
socket.emit("mic:update", {
  roomId,
  userId,
  enabled,
});
```

The backend updates runtime participant state:

```text
rooms
  |
  +-- participant.cameraEnabled
  +-- participant.microphoneEnabled
```

and broadcasts the change to other clients.

These are application-level synchronization events.

They do not replace WebRTC media negotiation.

---

## 27. Language state

The room also uses:

```text
language:update
```

The backend updates runtime state:

```text
users
rooms
```

and persists the participant's language into the active Session.

This is important for the translation pipeline.

The system needs to know:

```text
Who speaks which language?
Who needs translation?
```

The current main scenario is:

```text
Russian ↔ English
```

---

## 28. Chat and WebRTC are separate subsystems

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

Video/audio uses:

```text
WebRTC
```

Therefore:

```text
Chat message
    → Socket.IO + MongoDB

Video/audio
    → WebRTC
```

Socket.IO is not treated as a universal transport for every kind of media.

---

## 29. How realtime translation connects to video communication

This is especially important for understanding the project.

Both pipelines use the same local `MediaStream` as their source, but perform different jobs:

```text
                     MediaStream
                          |
              +-----------+-----------+
              |                       |
              v                       v
         simple-peer             AudioSender
              |                       |
              v                       v
         WebRTC media             audio-chunk
                                      |
                                      v
                                 SpeechService
                                      |
                                      v
                                   subtitle
```

The correct explanation is:

> WebRTC handles communication between participants, while the translation pipeline separately extracts audio from the local stream and sends PCM data to the backend for speech-to-text and translation.

---

## 30. Why `simple-peer`

Native WebRTC APIs are relatively low-level.

Without an abstraction layer, the developer would need to work directly with:

```text
RTCPeerConnection
createOffer
createAnswer
setLocalDescription
setRemoteDescription
onicecandidate
ontrack
addTrack
```

`simple-peer` provides a higher-level abstraction:

```ts
new Peer(...)
peer.signal(...)
peer.on("signal", ...)
peer.on("stream", ...)
peer.destroy()
```

This significantly reduces the amount of boilerplate required to manage peer connections and signaling.

---

## 31. `useRoomSession` lifecycle

`useRoomSession` coordinates the main realtime resources.

Startup:

```text
useMedia
   ↓
MediaStream

usePeer(stream)
   ↓
Peer state

useSocket(...)
   ↓
Socket connection
```

The peer and socket layers are connected through the signal callback:

```text
usePeer
   |
   | signal data
   v
handleSignal
   |
   v
useSocket
   |
   v
Socket.IO
```

When the room ends, the following resources must be cleaned up:

```text
Socket.IO
WebRTC peers
MediaStream
AudioSender
subtitle state
```

---

## 32. React lifecycle and duplicate sessions

Realtime room lifecycle is affected by the React lifecycle.

In development mode React may perform:

```text
mount
  ↓
cleanup
  ↓
mount
```

If cleanup immediately calls:

```ts
socket.disconnect();
```

the backend may observe:

```text
disconnect
    ↓
room becomes empty
    ↓
finishSession()
```

The next mount then sends:

```text
join-room
```

and the backend may create another Session.

This is an application lifecycle issue, not a WebRTC protocol feature.

The implementation accounts for this behavior in socket management.

---

## 33. What the Socket.IO server does

The Socket.IO server:

- registers users in rooms;
- routes `offer`;
- routes `answer`;
- routes ICE signaling;
- announces connections;
- announces disconnections;
- stores runtime participant state;
- handles chat events;
- receives audio chunks;
- sends subtitle events.

It is not the media server.

It should not be treated as a system through which normal video frames are forwarded:

```text
video frame
audio frame
```

Actual media transport is handled by WebRTC.

---

## 34. Main Socket.IO events

| Event               | Direction                 | Purpose               |
| ------------------- | ------------------------- | --------------------- |
| `join-room`         | client → server           | join a room           |
| `existing-users`    | server → client           | existing participants |
| `user-connected`    | server → client           | new participant       |
| `offer`             | client → server → client  | WebRTC offer          |
| `answer`            | client → server → client  | WebRTC answer         |
| `ice-candidate`     | client → server → client  | ICE signaling         |
| `user-disconnected` | server → client           | remove participant    |
| `camera:update`     | client → server → clients | camera state          |
| `mic:update`        | client → server → clients | microphone state      |

---

## 35. Main frontend files

Key implementation points:

```text
web/src/features/room-session/hooks/use-media.ts
```

Obtains the local `MediaStream`.

```text
web/src/features/room-session/hooks/use-peer.ts
```

Creates and manages `simple-peer` instances.

```text
web/src/features/room-session/hooks/use-socket.ts
```

Manages Socket.IO connection and signaling.

```text
web/src/features/room-session/hooks/use-room-session.ts
```

Composes room-level logic.

```text
web/src/features/room-session/model/types.ts
```

Contains signaling payload and room-state types.

---

## 36. Main backend files

```text
server/plugins/websocket.js
```

Socket.IO server, rooms, users, signaling, and realtime events.

```text
server/services/session.service.js
```

Session lifecycle.

```text
server/services/speech.service.js
```

Speech-to-text pipeline and the separate audio-processing branch.

```text
server/services/translation.service.js
```

Translation bridge.

The main WebRTC signaling logic is located in:

```text
server/plugins/websocket.js
```

---

## 37. WebRTC vs Socket.IO

This distinction should be understood very well.

### Socket.IO

Used for:

```text
signaling
chat
room events
audio chunks
subtitles
participant state
```

### WebRTC

Used for:

```text
audio
video
peer-to-peer media
```

Architecture:

```text
                Socket.IO
            signaling / events
            /               \
           v                 v
       Browser A         Browser B
           |                 |
           +--- WebRTC ------+
                media
```

Short explanation:

> Socket.IO coordinates the connection, while WebRTC carries the actual audio and video.

---

## 38. Complete technical chain

The entire video communication system can be reduced to:

```text
User opens room
      ↓
useMedia()
      ↓
MediaStream
      ↓
usePeer(stream)
      ↓
useSocket()
      ↓
Socket.IO connect
      ↓
join-room
      ↓
Backend room registration
      ↓
existing-users / user-connected
      ↓
createPeer()
      ↓
simple-peer "signal"
      ↓
offer / answer / ICE candidate
      ↓
Socket.IO signaling
      ↓
remote peer.signal(...)
      ↓
WebRTC negotiation
      ↓
WebRTC connection
      ↓
peer "stream"
      ↓
remoteStream
      ↓
remoteVideos
      ↓
React UI
```

This is the main video communication chain in Roomix.

---

## 39. What happens from the browser's perspective

Without framework terminology:

1. The browser requests access to the camera and microphone.
2. A `MediaStream` is created.
3. `simple-peer` receives the stream.
4. A separate peer is created for each remote participant.
5. Peer negotiation generates signaling data.
6. Signaling data is sent through Socket.IO.
7. The other browser receives that data.
8. Both peers perform WebRTC negotiation.
9. ICE helps discover a possible network path.
10. Once the connection is established, remote media arrives through WebRTC.
11. `peer.on("stream")` receives the remote `MediaStream`.
12. React receives the stream reference and renders the remote video.

---

## 40. How to explain the video system during a demonstration

### “Why don't you send video through Socket.IO?”

> Socket.IO is used in the project as a signaling and realtime-event transport, while WebRTC is designed for real-time media communication. Therefore Socket.IO carries small negotiation payloads, while the actual audio/video transport is handled by WebRTC.

### “Why is a signaling server needed?”

> Two browsers need to exchange negotiation information such as offers, answers, and ICE candidates. In Roomix, Socket.IO provides that signaling layer.

### “Does Fastify transmit the video?”

> No. Fastify and Socket.IO route signaling messages. The actual media stream is transferred through WebRTC.

### “What does simple-peer do?”

> It is an abstraction over the WebRTC peer connection API. It simplifies peer creation, signaling, and remote-stream handling.

### “What does initiator mean?”

> It determines which side starts the WebRTC negotiation.

### “What does trickle: true do?”

> It allows ICE candidates to be exchanged incrementally as they are discovered.

### “Why is STUN used?”

> It helps browsers obtain network information required to find a possible route between peers.

### “How does remote video appear?”

> After successful WebRTC negotiation, `simple-peer` receives the remote `MediaStream` through `peer.on("stream")`. The stream is associated with the socket ID, stored in runtime state, and then used by the React UI.

---

## 41. One-minute interview explanation

A concise technical version:

> The browser obtains a local `MediaStream` through `getUserMedia`, containing camera and microphone tracks. That stream is passed into `simple-peer`. For every other participant in the room, the application creates a separate peer connection. Socket.IO is used as the signaling transport: WebRTC offers, answers, and ICE candidates travel between browsers through it, but the actual video/audio stream does not. After negotiation, WebRTC establishes the peer-to-peer media connection. The remote `MediaStream` arrives through `peer.on("stream")`, is stored in runtime state, and is exposed to the React UI. When a participant disconnects, the peer and its remote stream are destroyed.

The core idea is:

```text
Signaling ≠ Media

Socket.IO
    → helps peers negotiate

WebRTC
    → carries actual audio/video
```

---

## 42. Current implementation limitations

Good technical documentation should record limitations as well as strengths.

### Mesh scaling

Every participant establishes a separate connection with every other participant.

This works for small rooms but scales poorly.

### STUN-only configuration

The code contains STUN, but no TURN relay is configured.

Therefore direct connectivity cannot be guaranteed in every NAT/firewall environment.

### WebSocket authentication

The HTTP routes use authentication middleware, but the current `join-room` Socket.IO flow does not demonstrate separate Clerk token validation inside the Socket.IO handshake.

This should be treated as a production-hardening area rather than something to claim as fully solved.

---

## 43. Final architecture

```text
                     RoomixRoom
                            |
               +------------+------------+
               |                         |
               v                         v
         Socket.IO                  WebRTC
        signaling/events             media
               |                         |
        +------+------+              +---+---+
        |      |      |              |       |
      rooms  chat  subtitles       audio   video
               |
               v
        speech / translation
```

Responsibilities:

```text
Socket.IO
    → realtime events + signaling

WebRTC
    → media transport

simple-peer
    → WebRTC abstraction

React
    → UI + frontend state

Fastify
    → server-side orchestration

MongoDB
    → persistent data

Speech/Translation services
    → speech recognition + translation
```

The central idea of the entire video communication architecture is:

```text
Signaling is not media.
```

Socket.IO tells peers how to establish the connection.

WebRTC carries the actual audio and video.

That separation is the key to understanding how Roomiximplements video communication, rather than merely knowing that the project uses `simple-peer`.
