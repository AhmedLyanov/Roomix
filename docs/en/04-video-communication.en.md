# Roomix— WebRTC and Video Communication

## 1. Purpose

Video communication is a core real-time feature of Roomix. Users enter the same room, grant access to their camera and microphone, establish peer-to-peer connections, and receive each other's media streams.

In this project, WebRTC is responsible for transferring audio and video between browsers. Socket.IO does **not** carry the actual video stream. It is used as a signaling channel through which participants exchange the data required to establish the WebRTC connection.

Simplified architecture:

```text
Browser A
   |
   | Socket.IO signaling
   v
Fastify + Socket.IO
   ^
   | Socket.IO signaling
   |
Browser B

After WebRTC negotiation:

Browser A <====================> Browser B
             MediaStream
           audio + video
```

This distinction is fundamental:

- Socket.IO helps the browsers negotiate the connection.
- WebRTC carries the actual media after the connection is established.

---

## 2. Main technologies

The video communication layer uses:

- Browser `MediaStream` for the local microphone and camera.
- `simple-peer` as a frontend abstraction over the WebRTC API.
- Socket.IO client for frontend signaling.
- Socket.IO server for backend signaling and room events.
- A STUN server for ICE network discovery.
- React hooks for room lifecycle, peer connections, and remote-stream state.

The project creates `simple-peer` instances with the following configuration:

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

Therefore:

- the local `MediaStream` is attached to each peer;
- `trickle ICE` is enabled;
- the configured infrastructure contains STUN, but no TURN relay is shown in the implementation.

---

## 3. Main frontend modules

The WebRTC flow is distributed across several hooks.

### `useMedia`

`useMedia` obtains the local `MediaStream` from the browser.

Conceptually:

```text
camera track
microphone track
       |
       v
   MediaStream
```

The same stream is used for:

- local video;
- `simple-peer`;
- the separate realtime translation pipeline through `AudioSender`.

Therefore video communication and speech translation share the same microphone source, but they process it through different pipelines.

### `usePeer`

`usePeer` is responsible for WebRTC peer connections.

It keeps:

```text
peersRef
remoteStreamsRef
remoteVideos
```

`peersRef` maps a participant's `socketId` to a `simple-peer` instance.

`remoteStreamsRef` maps a `socketId` to the corresponding remote `MediaStream`.

`remoteVideos` is React state used to trigger UI updates when a remote stream appears or disappears.

### `useSocket`

`useSocket` manages the Socket.IO connection and signaling.

It:

- connects to the Socket.IO server;
- sends `join-room`;
- receives existing participants;
- handles `user-connected`;
- routes `offer`;
- routes `answer`;
- routes `ice-candidate`;
- handles `user-disconnected`.

### `useRoomSession`

`useRoomSession` composes these pieces into a room-level API:

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

The room UI does not need to know the details of WebRTC negotiation. It receives higher-level data such as:

```ts
stream;
remoteVideos;
participants;
disconnect;
```

This keeps low-level connection management inside the room-session layer.

---

## 4. Entering a room

A user enters:

```text
/room/:roomId
```

`useRoomSession` starts the media flow, and `useMedia` obtains a local:

```ts
MediaStream;
```

That stream is passed into `usePeer`.

Then `useSocket` creates a Socket.IO connection:

```ts
io(process.env.NEXT_PUBLIC_SIGNALING_URL!, {
  path: "/ws",
  transports: ["websocket"],
  forceNew: true,
});
```

After the socket connects, the frontend sends:

```ts
socket.emit("join-room", {
  roomId,
  userId,
  userName,
  nativeLanguage,
  userAvatar,
});
```

On the backend, this event is connected to the room and Session lifecycle.

The backend:

1. adds the socket to the room;
2. stores runtime participant information;
3. sends the new participant the existing users;
4. informs existing users that a new participant joined;
5. creates or restores the active Session.

---

## 5. Backend runtime state

The Socket.IO server keeps two runtime `Map` structures.

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

A participant contains information such as:

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

The second map associates a socket with its user:

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

The responsibilities are therefore different:

```text
rooms
  -> participants belonging to a room

users
  -> information associated with a socket
```

`rooms` is useful for room-level operations, while `users` provides quick socket-to-user lookup.

---

## 6. How a new participant discovers existing users

When a user joins a room, the backend reads the current room and creates an `existingUsers` list.

Conceptually:

```ts
const existingUsers = Array.from(room.values())
  .filter((user) => user.socketId !== socket.id)
  .map((user) => ({
    socketId: user.socketId,
    userName: user.userName,
    userAvatar: user.userAvatar,
    cameraEnabled: user.cameraEnabled,
    microphoneEnabled: user.microphoneEnabled,
  }));
```

If users already exist:

```ts
socket.emit("existing-users", {
  users: existingUsers,
});
```

The new participant therefore receives the list of peers for which it must create WebRTC connections.

---

## 7. How existing users discover the new participant

At the same time, the backend informs the other participants:

```ts
socket.to(roomId).emit("user-connected", {
  socketId: participant.socketId,
  userId: participant.userId,
  userName: participant.userName,
  userAvatar: participant.userAvatar,
  cameraEnabled: participant.cameraEnabled,
  microphoneEnabled: participant.microphoneEnabled,
});
```

There are therefore two related flows:

```text
New participant
      |
      v
existing-users
      |
      v
create peers to existing participants
```

and:

```text
Existing participants
      |
      v
user-connected
      |
      v
create a peer to the new participant
```

This gives both sides the information required to establish their WebRTC connections.

---

## 8. What a peer connection means

A separate `simple-peer` instance is created for each other participant.

If a room contains:

```text
Ahmed
Ali
John
```

Ahmed has:

```text
Ahmed
  |
  +-- Peer(Ali)
  |
  +-- Peer(John)
```

Ali has:

```text
Ali
  |
  +-- Peer(Ahmed)
  |
  +-- Peer(John)
```

and so on.

This means the current implementation uses a mesh-like peer-to-peer topology.

The number of peer connections grows with the number of participants.

---

## 9. `peersRef`

Inside `usePeer`:

```ts
const peersRef = useRef<Map<string, Peer.Instance>>(new Map());
```

The key is:

```text
socketId
```

The value is:

```text
simple-peer instance
```

Conceptually:

```text
peersRef
  |
  +-- socketA -> Peer instance
  +-- socketB -> Peer instance
  +-- socketC -> Peer instance
```

`useRef` is appropriate for these objects because changing a peer instance should not itself cause a React render.

React state is used separately for values that the UI actually needs to react to.

---

## 10. Creating a peer

The main function is conceptually:

```ts
createPeer(socketId, initiator);
```

It first verifies that a local stream exists:

```ts
if (!stream) return null;
```

It then checks whether a peer already exists:

```ts
if (peersRef.current.has(socketId)) {
  return peersRef.current.get(socketId)!;
}
```

This prevents duplicate peer creation for the same socket.

The peer is then created:

```ts
const peer = new Peer({
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

## 11. Meaning of `initiator`

The:

```ts
initiator;
```

parameter determines which side starts the WebRTC negotiation.

When a new participant receives:

```text
existing-users
```

it creates peers with:

```ts
createPeer(socketId, true);
```

So the new participant acts as the initiator toward the existing participant.

When an existing participant receives:

```text
user-connected
```

it creates the peer with:

```ts
createPeer(socketId, false);
```

The two sides therefore have an explicit role during negotiation rather than both independently starting the same negotiation flow.

---

## 12. The `stream` passed to `Peer`

The local stream is passed into the peer:

```ts
stream;
```

This attaches the local audio/video tracks to the WebRTC connection.

Conceptually:

```text
getUserMedia()
      |
      v
 MediaStream
      |
      +--------------------+
      |                    |
      v                    v
 simple-peer          AudioSender
      |                    |
      v                    v
 WebRTC media          audio-chunk
```

These are two independent processing branches.

WebRTC sends the media stream to other participants.

`AudioSender` separately extracts PCM audio for speech recognition and realtime translation.

---

## 13. Why signaling is required

WebRTC does not mean that two browsers automatically know how to connect to one another.

They must exchange negotiation information.

The project uses Socket.IO for that purpose.

The main signaling events are:

```text
offer
answer
ice-candidate
```

Socket.IO is therefore a signaling transport.

It is not the media transport.

---

## 14. Offer

When the initiator creates a peer, `simple-peer` generates signaling data.

The frontend receives it through:

```ts
peer.on("signal", (data) => {
  ...
});
```

When:

```text
signalData.type === "offer"
```

the application prepares data containing:

```text
type
data
to
```

and sends:

```ts
socket.emit("offer", {
  offer: signal.data,
  to: signal.to,
});
```

The backend routes the offer:

```ts
socket.on("offer", ({ offer, to }) => {
  io.to(to).emit("offer", {
    offer,
    from: socket.id,
  });
});
```

Conceptually:

```text
Browser A
   |
   | offer
   v
Socket.IO
   |
   | offer
   v
Browser B
```

The backend does not interpret the WebRTC offer. It simply routes it to the target socket.

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

`simple-peer` processes the offer.

The peer then generates an answer.

When:

```text
signalData.type === "answer"
```

the frontend sends:

```ts
socket.emit("answer", {
  answer: signal.data,
  to: signal.to,
});
```

The backend routes it:

```ts
socket.on("answer", ({ answer, to }) => {
  io.to(to).emit("answer", {
    answer,
    from: socket.id,
  });
});
```

Browser A receives it:

```ts
socket.on("answer", ({ answer, from }) => {
  peersRef.current.get(from)?.signal(answer);
});
```

At this point, the two peers have exchanged the primary offer/answer negotiation information.

---

## 16. ICE candidates

Offer/answer alone is not sufficient.

Browsers also need to discover possible network paths between them.

That is handled through ICE.

The project creates peers with:

```ts
trickle: true;
```

This means ICE candidates can be emitted incrementally as they are discovered instead of waiting for all candidates to be gathered into one signaling payload.

When a `signal` payload is neither an offer nor an answer, the project treats it as:

```text
ice-candidate
```

and sends:

```ts
socket.emit("ice-candidate", {
  candidate: signal.data,
  to: signal.to,
});
```

The backend forwards it:

```ts
io.to(to).emit("ice-candidate", {
  candidate,
  from: socket.id,
});
```

The receiving browser passes it back into its peer:

```ts
socket.on("ice-candidate", ({ candidate, from }) => {
  peersRef.current.get(from)?.signal(candidate);
});
```

The simplified model is:

```text
Offer
  ↓
Answer
  ↓
ICE candidates
  ↓
WebRTC connection
```

In reality, signaling messages may arrive throughout negotiation, so this should be understood as an exchange of negotiation data rather than a rigid request-response sequence.

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

STUN helps the browser discover network information and identify a possible path to the other peer.

The current implementation explicitly shows STUN, but no TURN server is configured.

This is an important limitation.

In restrictive NAT or firewall environments, STUN alone may not be enough. A TURN server can provide relay-based connectivity when a direct peer-to-peer path cannot be established.

The documentation should therefore describe the actual implementation:

```text
STUN configured
TURN not shown
```

and should not claim that Roomixhas TURN infrastructure when the source code does not demonstrate it.

---

## 18. Receiving the remote stream

After the media connection is established:

```ts
peer.on("stream", (remoteStream) => {
  remoteStreamsRef.current.set(socketId, remoteStream);

  setRemoteVideos(new Map(remoteStreamsRef.current));
});
```

The data flow becomes:

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
remoteVideos state
    |
    v
React UI
```

This is the point at which the application receives the other participant's actual audio/video `MediaStream`.

---

## 19. Why `remoteStreamsRef` and `remoteVideos` are separate

`remoteStreamsRef` stores the current runtime `MediaStream` objects without requiring React to re-render for every internal mutation.

However, the UI must know when a stream appears or disappears.

Therefore the code creates a new Map:

```ts
setRemoteVideos(new Map(remoteStreamsRef.current));
```

React receives a new state object and renders the updated UI.

The conceptual split is:

```text
Ref
  |
  +-- runtime WebRTC objects

State
  |
  +-- data required by UI
```

This is a common pattern when working with long-lived browser objects such as WebRTC peers and media streams.

---

## 20. Disconnect handling

When a participant disconnects, the backend emits:

```ts
socket.to(roomId).emit("user-disconnected", {
  socketId: socket.id,
});
```

The frontend handles it:

```ts
socket.on("user-disconnected", ({ socketId }) => {
  removePeer(socketId);

  setParticipants((prev) => {
    const next = new Map(prev);
    next.delete(socketId);
    return next;
  });
});
```

`removePeer` destroys and removes the peer:

```ts
peersRef.current.get(socketId)?.destroy();
peersRef.current.delete(socketId);

remoteStreamsRef.current.delete(socketId);

setRemoteVideos(new Map(remoteStreamsRef.current));
```

Therefore the cleanup removes:

1. the WebRTC peer;
2. its runtime reference;
3. its remote `MediaStream`;
4. the participant's UI state.

---

## 21. Peer errors and close events

The peer layer also handles:

```ts
peer.on("close", () => removePeer(socketId));
peer.on("error", () => removePeer(socketId));
```

If a peer closes or encounters an error, it follows the same cleanup path.

This prevents `peersRef` from retaining stale peer instances that are no longer usable.

---

## 22. Full flow: one user enters

Suppose:

```text
Ahmed
```

opens:

```text
/room/123
```

The lifecycle is:

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

If no other users exist, WebRTC negotiation is not required yet.

---

## 23. Full flow: second user enters

Now suppose:

```text
Ahmed
Ali
```

are entering the same room.

Ali joins.

The backend sends:

```text
join-room(Ali)
       |
       +--> existing-users -> Ali
       |
       +--> user-connected -> Ahmed
```

Frontend behavior:

```text
Ali:
existing-users
    ↓
createPeer(Ahmed, true)
```

and:

```text
Ahmed:
user-connected
    ↓
createPeer(Ali, false)
```

The peers then exchange signaling through Socket.IO:

```text
Ali Peer(Ahmed)
        |
        | signaling
        v
    Socket.IO
        |
        | signaling
        v
Ahmed Peer(Ali)
```

Offer, answer, and ICE negotiation follow.

Once the WebRTC connection is established:

```text
Ali MediaStream
      |
      v
Ahmed remoteStream
```

and the opposite direction is established as well.

---

## 24. Complete signaling flow

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

The important architectural rule is:

```text
Socket.IO = signaling/events
WebRTC    = actual media
```

After negotiation, the video/audio stream does not need to travel through Fastify as ordinary Socket.IO messages.

---

## 25. Why Socket.IO instead of REST

REST is appropriate for operations such as:

```text
GET session
GET session actions
POST file
```

WebRTC signaling, however, requires a fast bidirectional channel for messages such as:

```text
offer
answer
ICE candidate
user-connected
user-disconnected
```

Socket.IO is therefore a better fit for this part of the system.

The same Socket.IO channel is also used for:

- room events;
- chat;
- audio chunks used by speech-to-text;
- subtitles;
- camera state;
- microphone state.

This gives the realtime room subsystem one common event transport while keeping WebRTC itself responsible for media.

---

## 26. Camera and microphone state

The room contains dedicated events:

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

The backend updates participant runtime state:

```text
rooms
  |
  +-- participant.cameraEnabled
  +-- participant.microphoneEnabled
```

and broadcasts the updated state to other clients.

These events do not replace WebRTC media negotiation.

They synchronize participant controls and UI state.

---

## 27. Where realtime translation fits

An important architectural detail is that video communication and translation are connected through the same `MediaStream`, but they are not the same subsystem.

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

Therefore the clean explanation is:

> WebRTC is responsible for communication between participants, while the translation pipeline extracts audio from the local stream and sends PCM data to the backend for speech-to-text and translation.

This is an important separation of responsibilities.

---

## 28. Why mesh architecture has a scaling limitation

In the current implementation, every participant establishes a separate peer connection with every other participant.

If:

```text
N = number of participants
```

the number of pairwise connections grows approximately as:

```text
N × (N - 1) / 2
```

Examples:

```text
2 users → 1 connection
3 users → 3 connections
4 users → 6 connections
5 users → 10 connections
```

This is reasonable for small rooms but scales poorly for large conferences.

A production system intended for large rooms would commonly use an SFU architecture.

Roomixdoes not use an SFU in the current implementation, so the correct description is a mesh-like peer-to-peer topology.

---

## 29. Why `simple-peer`

The native WebRTC API is relatively low-level.

Without an abstraction, the developer would need to work directly with APIs such as:

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

`simple-peer` provides a higher-level abstraction.

The project can therefore work primarily with:

```ts
new Peer(...)
peer.signal(...)
peer.on("signal", ...)
peer.on("stream", ...)
peer.destroy()
```

This significantly reduces peer-management and signaling boilerplate.

---

## 30. `useRoomSession` lifecycle

`useRoomSession` composes the room resources.

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

On disconnect:

```ts
disconnectSocket();
destroyAllPeers();
stopStream();
clearSubtitles();
```

The room-level lifecycle therefore coordinates the major resources.

---

## 31. Cleanup

The room should clean up:

```text
Socket.IO connection
WebRTC peers
MediaStream
AudioSender
subtitle state
```

For peers:

```ts
destroyAllPeers();
```

For local media:

```ts
stopStream();
```

For Socket.IO:

```ts
disconnectSocket();
```

For translation state:

```ts
clearSubtitles();
```

This matters especially in React development mode, where Strict Mode may cause:

```text
mount → cleanup → mount
```

The project accounts for this lifecycle in the socket management so that a development remount does not immediately terminate the realtime session and create another Session.

---

## 32. React Strict Mode and duplicate Sessions

This is a practical issue encountered in the project.

If React development lifecycle performs:

```text
mount
  ↓
cleanup
  ↓
mount
```

and cleanup immediately executes:

```ts
socket.disconnect();
```

the backend can observe:

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

again.

The backend may create another Session.

The result can be:

```text
one logical room
        |
        +--> Session A
        |
        +--> Session B
```

instead of one continuous Session.

The current implementation uses delayed socket disconnect behavior to allow the React Strict Mode development remount to occur without immediately finishing the realtime session.

This is not a WebRTC protocol feature. It is application lifecycle protection against React development-mode behavior.

---

## 33. What the Socket.IO server does and does not do

### It does

The Socket.IO server:

- registers users in rooms;
- routes `offer`;
- routes `answer`;
- routes ICE signaling;
- announces user connections;
- announces user disconnections;
- stores runtime participant state;
- transports chat events;
- receives audio chunks;
- sends subtitle events.

### It does not

The Socket.IO server is not the application's video-stream storage or media relay.

The architecture does not treat:

```text
video frame
audio frame
```

as ordinary Socket.IO messages that are forwarded between all users.

Media is handled by WebRTC.

---

## 34. Main Socket.IO events related to WebRTC

| Event               | Direction                 | Purpose                               |
| ------------------- | ------------------------- | ------------------------------------- |
| `join-room`         | client → server           | join a room                           |
| `existing-users`    | server → client           | list participants already in the room |
| `user-connected`    | server → client           | announce a new participant            |
| `offer`             | client → server → client  | route a WebRTC offer                  |
| `answer`            | client → server → client  | route a WebRTC answer                 |
| `ice-candidate`     | client → server → client  | route ICE signaling data              |
| `user-disconnected` | server → client           | remove a participant                  |
| `camera:update`     | client → server → clients | synchronize camera state              |
| `mic:update`        | client → server → clients | synchronize microphone state          |

---

## 35. Main frontend files

The primary implementation points are:

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

Composes the room-level logic.

```text
web/src/features/room-session/model/types.ts
```

Contains signaling payload and room-state types.

---

## 36. Main backend files

The primary backend implementation points are:

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

The WebRTC signaling logic itself is implemented in:

```text
server/plugins/websocket.js
```

---

## 37. WebRTC vs Socket.IO

This distinction should be memorized.

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

A useful one-sentence explanation is:

> Socket.IO coordinates the connection; WebRTC carries the actual audio and video.

---

## 38. Complete technical flow

The whole implementation can be reduced to:

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
5. Peer negotiation produces signaling data.
6. Signaling data is sent through Socket.IO.
7. The other browser receives that signaling data.
8. Both peers perform WebRTC negotiation.
9. ICE helps discover a possible network path.
10. Once the connection is established, remote media arrives through WebRTC.
11. `peer.on("stream")` receives the remote `MediaStream`.
12. React stores the stream reference and renders the remote video.

---

## 40. What a developer should be able to explain during a demonstration

After studying this document, a developer should be able to answer:

### Why not send video through Socket.IO?

Because Socket.IO is being used as a signaling/realtime-event transport, while WebRTC is designed for real-time media communication.

### Why is a signaling server needed?

Two browsers need to exchange negotiation information such as:

```text
offer
answer
ICE candidates
```

### Does Fastify transmit the video?

No. In the current architecture, Fastify/Socket.IO routes signaling messages. The actual media is transferred through WebRTC.

### What does `simple-peer` do?

It provides a higher-level abstraction over WebRTC peer connections and signaling data.

### What is `initiator`?

It determines which peer begins the negotiation.

### What does `trickle: true` do?

It allows ICE signaling data to be exchanged incrementally as candidates are discovered.

### Why is STUN used?

It helps browsers discover network information needed to find a possible route between peers.

### Where is the remote video kept?

It is first stored in `remoteStreamsRef`, then copied into `remoteVideos` state so the React UI can update.

### What happens on disconnect?

The peer is destroyed, the remote stream is removed, participant UI state is cleared, and the backend removes the socket from the room.

### How is video communication connected to translation?

Both use the same source `MediaStream`, but through different pipelines:

```text
MediaStream
   |
   +--> WebRTC --> remote audio/video
   |
   +--> AudioSender --> PCM --> speech-to-text --> translation
```

---

## 41. One-minute interview explanation

A concise technical explanation:

> The browser obtains a MediaStream through `getUserMedia`, containing the local camera and microphone tracks. That stream is passed into `simple-peer`. For every other participant in the room, the application creates a separate peer connection. Socket.IO is used only as the signaling transport: it routes WebRTC offers, answers, and ICE candidates between browsers, but it does not carry the actual video or audio stream. After negotiation, WebRTC establishes the peer-to-peer media connection. The remote MediaStream is received through `peer.on("stream")`, stored in runtime state, and exposed to the React UI. When a participant disconnects, the peer and remote stream are destroyed and removed from the room state.

The core idea is simple:

```text
Signaling is not media.

Socket.IO tells peers how to connect.
WebRTC carries the actual audio/video.
```

That is the essential architecture without reducing it to the meaningless phrase "we just added WebRTC."

---

## 42. Architectural limitations of the current implementation

Good documentation must record limitations as well as strengths.

### Mesh scaling

Every participant connects directly to the other participants.

This is suitable for small rooms but scales poorly as participant count grows.

### STUN-only configuration

The shown `simple-peer` configuration contains a STUN server, but no TURN relay is configured.

Therefore direct connectivity cannot be guaranteed in every NAT/firewall environment.

### Signaling authentication

The provided implementation shows HTTP authentication, but the Socket.IO `join-room` flow does not demonstrate a separate Clerk-token validation inside the Socket.IO handshake.

This should therefore be considered a potential production-hardening area rather than something to claim as fully solved.

---

## 43. Final architecture

Roomixseparates realtime communication into several layers:

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

The responsibilities are therefore:

- Socket.IO coordinates realtime events and signaling.
- WebRTC transfers media.
- React manages the UI and frontend state.
- The backend manages room and Session state.
- Dedicated services handle speech recognition and translation.

The central concept is:

```text
Signaling is not media.
```

Socket.IO tells peers how to connect.

WebRTC carries the actual audio and video.

Understanding this distinction is the key to understanding Roomix's video communication implementation rather than merely knowing that the project uses `simple-peer`.
