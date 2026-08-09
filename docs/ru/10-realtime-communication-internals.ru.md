# Merriweather — Realtime Communication Internals

## 1. Purpose

This document is a deeper engineering-level explanation of the realtime communication subsystem in Merriweather.

The previous WebRTC documentation explains the architecture and the main implementation points. This document focuses on the internal execution model:

- how a browser enters a room;
- how runtime participants are registered;
- how `existing-users` and `user-connected` establish negotiation roles;
- how `simple-peer` is connected to Socket.IO;
- how `offer`, `answer`, and ICE candidates travel through the system;
- where the actual audio/video media travels;
- how remote `MediaStream` objects reach React UI;
- how camera and microphone state are synchronized;
- how screen sharing replaces the outgoing video track;
- how cleanup works;
- how the same local `MediaStream` feeds both WebRTC and realtime translation;
- why the current topology is a peer-to-peer mesh;
- and how to debug the complete pipeline by boundaries.

The goal is not to memorize API names. The goal is to understand the runtime sequence well enough to explain or debug it without relying on the documentation.

---

## 2. The Core Separation

The realtime subsystem consists of several different mechanisms that cooperate but should not be confused with one another.

```text
Browser Media APIs
        |
        v
   MediaStream
      /    \
     /      \
    v        v
WebRTC    AudioSender
  |            |
  |            v
  |        audio-chunk
  |            |
  v            v
peer media   Socket.IO
               |
               v
          Speech/Translation
```

At the same time:

```text
Socket.IO
    |
    +--> room events
    +--> WebRTC signaling
    +--> participant state
    +--> chat
    +--> audio chunks
    +--> subtitles
```

The most important distinction is:

```text
Socket.IO
    = signaling + application realtime events

WebRTC
    = actual peer-to-peer audio/video transport
```

Socket.IO does not continuously transport the camera stream.

---

## 3. Runtime Components

The room communication layer consists of:

```text
Frontend
├── MediaStream
├── simple-peer
├── Socket.IO client
├── React state
└── runtime Maps/Refs

Backend
├── Socket.IO server
├── rooms Map
├── users Map
└── signaling handlers

WebRTC infrastructure
└── STUN / ICE discovery
```

The primary implementation points documented in the project are:

```text
web/src/features/room-session/hooks/use-media.ts
web/src/features/room-session/hooks/use-peer.ts
web/src/features/room-session/hooks/use-socket.ts
web/src/features/room-session/hooks/use-room-session.ts
web/src/features/room-session/model/types.ts

server/plugins/websocket.js
```

The WebRTC signaling logic lives in the backend Socket.IO plugin, while peer creation and remote stream handling live on the frontend.

---

## 4. Entering `/room/:roomId`

The room lifecycle starts when the browser opens:

```text
/room/:roomId
```

The logical sequence is:

```text
Browser
   ↓
useMedia()
   ↓
getUserMedia()
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
```

The important dependency is that the socket/peer lifecycle depends on the local media stream being available.

The frontend creates the Socket.IO connection using:

```ts
io(process.env.NEXT_PUBLIC_SIGNALING_URL!, {
  path: "/ws",
  transports: ["websocket"],
  forceNew: true,
});
```

The server therefore needs to expose the same Socket.IO path:

```text
/ws
```

---

## 5. Obtaining the Local MediaStream

The browser requests:

```ts
navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true,
});
```

The result is:

```text
MediaStream
├── video track
└── audio track
```

This object becomes the source for multiple subsystems.

The local video element receives the stream:

```text
MediaStream
     ↓
localVideo.srcObject
```

At the same time, the stream is supplied to WebRTC peers.

Most importantly, the audio track is also consumed by the realtime translation branch.

---

## 6. One MediaStream, Two Pipelines

This is one of the most important architectural details in Merriweather.

The same local `MediaStream` feeds two independent paths:

```text
                         MediaStream
                              |
                 +------------+------------+
                 |                         |
                 v                         v
             simple-peer              AudioSender
                 |                         |
                 v                         v
           WebRTC media                audio-chunk
                 |                         |
                 v                         v
        other participants          SpeechService
                                           |
                                           v
                                    STT / Translation
```

The two branches have different purposes.

WebRTC:

```text
camera + microphone
        ↓
peer-to-peer communication
```

Translation:

```text
microphone
    ↓
audio processing
    ↓
PCM chunks
    ↓
backend
    ↓
speech recognition
    ↓
translation
```

Therefore a failure in translation does not inherently mean that WebRTC video communication has failed.

---

## 7. Socket.IO Connection

After the local stream exists, the frontend establishes a Socket.IO connection.

Conceptually:

```text
Browser
   |
   | websocket
   v
Fastify + Socket.IO
```

The frontend uses:

```ts
transports: ["websocket"]
```

and:

```ts
path: "/ws"
```

The connection is stored in:

```ts
socketRef
```

This is a runtime reference, not React UI state.

The application uses the socket for long-lived realtime communication.

---

## 8. `join-room`

Once Socket.IO connects, the client emits:

```text
join-room
```

with:

```text
roomId
userId
userName
nativeLanguage
userAvatar
```

The backend then performs several operations.

Conceptually:

```text
join-room
    |
    +--> socket.join(roomId)
    |
    +--> register participant in rooms
    |
    +--> register user in users
    |
    +--> determine existing participants
    |
    +--> emit existing-users
    |
    +--> emit user-connected
    |
    +--> create/retrieve Session
```

This event therefore initializes both:

```text
realtime room state
```

and:

```text
session lifecycle
```

---

## 9. Backend Runtime Room State

The backend keeps runtime state in two Maps.

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

A participant contains values such as:

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

The distinction is useful:

```text
rooms
    = who is currently inside a room

users
    = who a socket belongs to
```

This state is process memory.

It is not MongoDB persistence.

---

## 10. Existing Participants

Suppose:

```text
Ahmed
```

is already inside the room.

When:

```text
Ali
```

joins, the backend sees Ahmed in the room.

Ali receives:

```text
existing-users
```

containing Ahmed.

The frontend handles it conceptually as:

```text
existing-users
      ↓
for each participant
      ↓
createPeer(socketId, true)
```

The `true` means:

```text
initiator = true
```

Therefore the new participant becomes the initiator for the peer connection.

---

## 11. Notifying Existing Participants

At the same time, Ahmed receives:

```text
user-connected
```

containing Ali.

The existing participant creates:

```text
createPeer(socketId, false)
```

Therefore:

```text
Ali
  → initiator = true

Ahmed
  → initiator = false
```

This creates one clear negotiation direction.

The distinction prevents both sides from independently behaving as initiators for the same peer connection.

---

## 12. Why `initiator` Matters

A peer connection needs one side to begin the offer/answer negotiation.

In Merriweather:

```text
new participant
      |
      +--> initiator = true
```

and:

```text
existing participant
      |
      +--> initiator = false
```

The resulting pair is:

```text
Ali Peer
   |
   | initiator
   v
Ahmed Peer
```

This is an application-level convention used to keep negotiation deterministic.

---

## 13. `peersRef`

The frontend stores active WebRTC peers in:

```ts
useRef<Map<string, Peer.Instance>>(new Map())
```

The mapping is:

```text
socketId → Peer.Instance
```

Example:

```text
peersRef
├── socketA → Peer
├── socketB → Peer
└── socketC → Peer
```

The ref is appropriate because `Peer.Instance` is a mutable runtime object.

Changing the peer itself should not require React to rerender the entire UI.

---

## 14. Creating a Peer

The central operation is:

```ts
createPeer(socketId, initiator)
```

A peer is created conceptually as:

```ts
new Peer({
  initiator,
  trickle: true,
  stream,
});
```

The peer receives the local `MediaStream`.

This means:

```text
local camera track
        +
local microphone track
        ↓
    simple-peer
        ↓
    WebRTC peer
```

The project also uses STUN:

```text
stun:stun.l.google.com:19302
```

and:

```text
trickle: true
```

which enables incremental ICE candidate exchange.

---

## 15. Preventing Duplicate Peer Instances

Before creating a peer, the implementation checks whether one already exists for that socket.

Conceptually:

```ts
if (peersRef.current.has(socketId)) {
  return peersRef.current.get(socketId)!;
}
```

This matters because multiple peer objects for the same participant would produce competing negotiation flows and make cleanup unreliable.

The intended invariant is:

```text
one socketId
    ↓
one active Peer.Instance
```

for each local participant.

---

## 16. `simple-peer` as the WebRTC Abstraction

The browser WebRTC API is low-level.

Without an abstraction layer, the application would have to directly coordinate objects and methods such as:

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

Merriweather uses:

```text
simple-peer
```

which provides a simpler event-driven interface:

```ts
new Peer(...)
peer.signal(...)
peer.on("signal", ...)
peer.on("stream", ...)
peer.destroy()
```

The project therefore delegates much of the low-level WebRTC negotiation machinery to `simple-peer`.

---

## 17. Signaling

WebRTC itself does not provide the application-level signaling server used to introduce two browsers to one another.

Merriweather uses Socket.IO for this purpose.

The main signaling messages are:

```text
offer
answer
ice-candidate
```

The conceptual architecture is:

```text
Browser A
    |
    | signaling
    v
Socket.IO server
    |
    | signaling
    v
Browser B
```

The backend does not need to understand the internal meaning of SDP.

Its responsibility is primarily to route signaling payloads to the correct socket.

---

## 18. Offer Flow

The initiator's `simple-peer` emits a `signal` event.

When the signal represents an offer, the frontend sends:

```text
offer
```

to the target socket.

Conceptually:

```text
Peer A
   ↓
peer.on("signal")
   ↓
socket.emit("offer")
   ↓
Fastify + Socket.IO
   ↓
io.to(target).emit("offer")
   ↓
Peer B
```

The backend is acting as a signaling router.

It is not negotiating the WebRTC session itself.

---

## 19. Answer Flow

Peer B receives:

```text
offer
```

The frontend obtains or creates the corresponding peer:

```text
peersRef.get(from)
```

and passes the offer into:

```ts
peer.signal(offer)
```

`simple-peer` then generates the answer.

The answer follows the reverse path:

```text
Peer B
   ↓
answer
   ↓
Socket.IO
   ↓
Peer A
```

Peer A then processes:

```ts
peer.signal(answer)
```

---

## 20. ICE Candidate Flow

Offer and answer are not enough.

Browsers also need to discover viable network paths.

This is handled through ICE.

Because the peer is configured with:

```text
trickle: true
```

candidates can be sent incrementally.

The flow is:

```text
Peer A
   ↓
ICE candidate
   ↓
Socket.IO
   ↓
Peer B
```

and in the opposite direction as necessary.

The receiver passes the candidate back into its peer instance.

Conceptually:

```text
offer
  ↓
answer
  ↓
ICE candidates
  ↓
WebRTC connectivity
```

The actual exchange is asynchronous and candidates can arrive while negotiation is still progressing.

---

## 21. STUN and Current Network Configuration

The peer configuration contains:

```text
STUN
  stun:stun.l.google.com:19302
```

STUN helps browsers discover network information needed to attempt direct peer connectivity.

The current implementation demonstrates:

```text
STUN = configured
TURN = not configured
```

This distinction matters.

STUN does not relay the media stream.

TURN can act as a relay when direct peer-to-peer connectivity is impossible because of NAT or firewall restrictions.

Therefore the current implementation should be described honestly as having STUN-based ICE configuration rather than a complete TURN infrastructure.

---

## 22. Where the Actual Video Travels

This is the single most important networking concept in the project.

After negotiation succeeds:

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

The live media does not normally travel through:

```text
Fastify
Socket.IO
MongoDB
```

Those components participate in:

```text
signaling
application events
persistence
```

while WebRTC handles:

```text
actual audio/video transport
```

A good mental model is:

```text
Socket.IO
    =
"How do the browsers coordinate the connection?"

WebRTC
    =
"Now transport the media."
```

---

## 23. Receiving the Remote MediaStream

When the WebRTC peer receives remote media, `simple-peer` emits:

```text
stream
```

The frontend stores the stream:

```text
socketId
    ↓
remoteStreamsRef
    ↓
MediaStream
```

Then it updates React state:

```text
remoteVideos
```

Conceptually:

```text
Remote Peer
    ↓
remote MediaStream
    ↓
remoteStreamsRef
    ↓
remoteVideos
    ↓
React UI
    ↓
<video>.srcObject
```

The browser then renders the participant's camera feed.

---

## 24. `remoteStreamsRef` vs `remoteVideos`

The implementation deliberately separates runtime media objects from UI state.

```text
remoteStreamsRef
    =
actual MediaStream objects

remoteVideos
    =
React state used to render the UI
```

This is useful because `MediaStream` is a mutable browser object.

The application stores it in a ref:

```text
remoteStreamsRef
```

and creates a new `Map` when React needs to rerender:

```text
setRemoteVideos(
    new Map(remoteStreamsRef.current)
)
```

Therefore:

```text
WebRTC runtime object
        ≠
React render state
```

They cooperate, but they have different responsibilities.

---

## 25. Participant State Is Not Media State

The application also maintains participant metadata:

```text
userName
userAvatar
cameraEnabled
microphoneEnabled
```

For example:

```text
cameraEnabled = false
```

is an application-level state value.

It is not the video stream itself.

The distinction is:

```text
Participant state
    ↓
UI metadata

MediaStream
    ↓
actual audio/video data
```

This allows the UI to show status independently of the underlying WebRTC objects.

---

## 26. Camera State Synchronization

When the local user toggles the camera, the frontend changes the video track:

```ts
stream.getVideoTracks().forEach(
  (track) => (track.enabled = !track.enabled)
);
```

It also updates local React state.

For remote UI synchronization, the room uses:

```text
camera:update
```

The backend updates the participant's runtime state and broadcasts the change to the other clients.

Conceptually:

```text
Browser A
   |
   | camera:update
   v
Socket.IO server
   |
   | camera:update
   v
Browser B
   |
   v
participant.cameraEnabled
```

This event is metadata synchronization.

It is not a replacement for the actual WebRTC media transport.

---

## 27. Microphone State Synchronization

The same architectural idea is used for:

```text
mic:update
```

The application tracks whether the microphone is enabled and broadcasts that state through Socket.IO.

Therefore:

```text
WebRTC
    → carries audio

Socket.IO
    → communicates microphone state
```

Again, these are two different responsibilities.

---

## 28. Screen Sharing

Screen sharing uses the browser:

```ts
navigator.mediaDevices.getDisplayMedia({
  video: true,
});
```

This creates a new screen `MediaStream`.

The important operation is not creating an entirely new WebRTC connection.

Instead, the existing outgoing video track is replaced.

Conceptually:

```text
Camera Track
     |
     | replaceTrack()
     v
Screen Track
```

The project stores:

```text
originalTrackRef
screenStreamRef
```

so the camera can later be restored.

---

## 29. Replacing the Video Track

For each active peer, the implementation accesses the underlying `RTCPeerConnection` sender and performs:

```text
sender.replaceTrack(screenTrack)
```

The conceptual flow is:

```text
Existing Peer
     |
     v
RTCRtpSender
     |
     | replaceTrack()
     v
Screen Track
```

This allows the existing WebRTC connection to continue while the media source changes from:

```text
camera
```

to:

```text
screen
```

The application does not need to create a new peer connection for every screen-share action.

---

## 30. Returning From Screen Share

When screen sharing stops:

```text
Screen Track
     ↓
replaceTrack(cameraTrack)
     ↓
Camera Track
```

The screen stream is stopped.

The original camera track is restored.

The local video element is updated again.

Conceptually:

```text
stop screen share
      ↓
restore camera track
      ↓
stop screen MediaStream tracks
      ↓
clear screen-share refs
      ↓
update UI
```

---

## 31. Disconnect Lifecycle

When a participant disconnects, the backend emits:

```text
user-disconnected
```

The frontend calls:

```text
removePeer(socketId)
```

Cleanup removes:

```text
Peer.Instance
remote MediaStream
participant state
peer Map entry
remote stream Map entry
```

Conceptually:

```text
disconnect
    |
    +--> destroy peer
    |
    +--> delete peer reference
    |
    +--> delete remote stream
    |
    +--> update React state
```

This prevents stale peers and streams from accumulating.

---

## 32. Peer-Level Errors

The peer layer also handles:

```text
peer.on("close")
peer.on("error")
```

Both can use the same cleanup path.

This is important because a WebRTC peer can fail independently of the Socket.IO connection.

Therefore:

```text
Socket connected
```

does not necessarily mean:

```text
WebRTC peer healthy
```

and:

```text
Socket disconnected
```

is not the only possible reason to remove a peer.

---

## 33. Leaving the Room

When the local user explicitly leaves:

```text
destroy all peers
    ↓
clear peersRef
    ↓
disconnect socket
    ↓
stop MediaStream tracks
    ↓
navigate away
```

This is a deliberate cleanup sequence.

Stopping the local media tracks matters because otherwise camera/microphone resources may remain active even after leaving the visible room.

---

## 34. React Lifecycle and Realtime Resources

Realtime resources are long-lived and therefore sensitive to React lifecycle behavior.

The room lifecycle involves:

```text
useMedia
    ↓
MediaStream

usePeer(stream)
    ↓
Peer objects

useSocket(...)
    ↓
Socket.IO connection
```

Cleanup must therefore happen in the reverse conceptual direction:

```text
Socket.IO
WebRTC peers
MediaStream
AudioSender
```

The project also uses guards such as:

```text
initializedRef
joinedRef
```

to prevent repeated initialization.

This is especially important in development environments where React lifecycle behavior can expose duplicate initialization problems.

---

## 35. The Duplicate Session Problem

A realtime room can accidentally create multiple Session records if the application connects, disconnects, and reconnects at the wrong time.

The relevant lifecycle is:

```text
join-room
    ↓
createSession()
```

and:

```text
disconnect
    ↓
room empty
    ↓
finishSession()
```

If a temporary development lifecycle causes:

```text
connect
    ↓
join
    ↓
disconnect
    ↓
finishSession
    ↓
connect again
```

the backend can legitimately see two session lifecycles.

This is why React lifecycle and realtime resource cleanup are not merely frontend implementation details.

They directly affect backend persistence.

---

## 36. Complete Two-Participant Flow

Assume:

```text
Ahmed
```

is already in:

```text
room/123
```

Then:

```text
Ali
```

joins.

### Ali

```text
getUserMedia()
      ↓
MediaStream
      ↓
Socket.IO connect
      ↓
join-room
      ↓
existing-users
      ↓
createPeer(Ahmed, true)
```

### Ahmed

```text
user-connected
      ↓
createPeer(Ali, false)
```

Then:

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

ICE candidates are exchanged during negotiation.

After successful negotiation:

```text
Ahmed MediaStream
       ⇅
    WebRTC
       ⇅
Ali MediaStream
```

Socket.IO remains available for:

```text
room events
chat
participant state
subtitles
signaling
```

---

## 37. Complete Communication Diagram

```text
                         Fastify
                           |
                     Socket.IO Server
                           |
          +----------------+----------------+
          |                                 |
          | signaling / events              |
          |                                 |
      Browser A                         Browser B
          |                                 |
      Peer A                              Peer B
          |                                 |
          +========== WebRTC ===============+
                     audio/video
```

The backend is therefore not the media relay in the current architecture.

---

## 38. Multi-Participant Topology

The current implementation creates a peer for every other participant.

For:

```text
Ahmed
Ali
John
```

the connections are:

```text
Ahmed ↔ Ali
Ahmed ↔ John
Ali   ↔ John
```

The number of pairwise connections is:

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

This is a mesh-style peer-to-peer topology.

It is straightforward for small rooms but becomes increasingly expensive as participant count grows.

---

## 39. Why the Mesh Architecture Is Useful Here

For a portfolio-scale project, mesh WebRTC has an important advantage:

```text
simple architecture
+
no central media server
+
real browser-to-browser media
```

It demonstrates actual WebRTC knowledge without requiring an SFU infrastructure.

The trade-off is scalability.

For large conferences, a common next step would be an SFU architecture where clients send media to a media server and receive selected streams from it.

That is not the current implementation.

---

## 40. Socket.IO Is More Than WebRTC Signaling

The same Socket.IO connection also handles:

```text
join-room
user-connected
user-disconnected
camera:update
mic:update
chat:send
audio-chunk
subtitle
offer
answer
ice-candidate
```

This is convenient because one realtime transport is shared by several application features.

However, the payloads have very different purposes.

```text
offer / answer / ICE
    → WebRTC signaling

camera:update / mic:update
    → application state

chat
    → messaging

audio-chunk
    → speech pipeline

subtitle
    → translation result
```

Only some of these messages are directly related to WebRTC.

---

## 41. WebRTC and Translation Are Parallel Pipelines

The strongest architectural relationship between video communication and realtime translation is that they share the same local media source.

```text
                       MediaStream
                            |
                +-----------+-----------+
                |                       |
                v                       v
           simple-peer              AudioSender
                |                       |
                v                       v
         WebRTC media              audio-chunk
                                        |
                                        v
                                  Socket.IO
                                        |
                                        v
                                  SpeechService
                                        |
                                        v
                                   Python STT
                                        |
                                        v
                                     text
                                        |
                                        v
                               TranslationService
                                        |
                                        v
                                    subtitle
```

The branches are independent after the initial media source.

This explains why the application can simultaneously:

```text
send your voice to another participant
```

and:

```text
send audio-derived PCM chunks to the translation pipeline
```

---

## 42. Why Translation Does Not Use WebRTC Remote Audio

The translation pipeline is based on the speaker's local microphone stream.

The local browser already has access to:

```text
microphone track
```

Therefore it can process that audio before or alongside WebRTC transmission.

The architecture does not require:

```text
remote participant audio
    ↓
capture from remote video
    ↓
translation
```

for the speaker's own realtime speech.

Instead:

```text
local microphone
      ↓
MediaStream
      ↓
AudioSender
      ↓
speech pipeline
```

This avoids introducing another audio capture layer for the speaker.

---

## 43. Realtime Translation Dependency on Socket.IO

Although WebRTC carries the actual voice stream between participants, the translation pipeline deliberately uses Socket.IO for its own audio processing channel.

Therefore:

```text
WebRTC
    → participant media

Socket.IO
    → audio chunks for STT
```

This distinction is crucial.

The audio sent as `audio-chunk` is not simply the same thing as the WebRTC media transport.

It is a separate representation produced specifically for speech recognition.

---

## 44. Debugging the Connection Pipeline

When video communication fails, debugging should follow the actual architecture.

### Step 1 — Media

Verify:

```text
getUserMedia()
```

returns a valid:

```text
MediaStream
```

### Step 2 — Socket

Verify:

```text
connect
```

fires.

### Step 3 — Room

Verify:

```text
join-room
```

reaches the backend.

### Step 4 — Participant discovery

Verify:

```text
existing-users
user-connected
```

are received.

### Step 5 — Peer creation

Verify:

```text
createPeer()
```

creates exactly one peer per participant.

### Step 6 — Signaling

Verify:

```text
offer
answer
ice-candidate
```

are exchanged.

### Step 7 — WebRTC

Verify:

```text
peer connection
```

reaches a usable state.

### Step 8 — Remote stream

Verify:

```text
peer.on("stream")
```

fires.

### Step 9 — UI

Verify:

```text
remoteVideos
```

updates and the stream is assigned to:

```text
video.srcObject
```

---

## 45. Debugging Signaling vs Media

A common mistake is to treat:

```text
Socket.IO connected
```

as equivalent to:

```text
WebRTC connected
```

They are different layers.

Possible state:

```text
Socket.IO = connected
WebRTC peer = failed
```

Another possible state:

```text
Socket.IO = disconnected
WebRTC = already established
```

The latter may continue briefly depending on the existing peer connection, although signaling for new negotiation is unavailable.

Therefore debugging should always identify which transport is failing.

---

## 46. Debugging `existing-users`

If a second user joins and no video connection starts, inspect:

```text
existing-users
```

The new participant should receive the existing participant list.

Then:

```text
existing-users
    ↓
createPeer(socketId, true)
```

If this does not happen, the failure is before WebRTC negotiation.

It is a room/signaling initialization problem.

---

## 47. Debugging `user-connected`

The existing participant should receive:

```text
user-connected
```

The current architecture uses this event to update participant state and establish the non-initiator side when the corresponding offer arrives.

Therefore:

```text
user-connected
```

is primarily participant discovery/state synchronization.

The actual offer/answer exchange is handled by:

```text
offer
answer
ice-candidate
```

---

## 48. Debugging Offer/Answer

If:

```text
existing-users
```

works but no connection forms, inspect:

```text
offer
```

Then:

```text
answer
```

Expected:

```text
initiator
   ↓
offer
   ↓
Socket.IO
   ↓
receiver
   ↓
answer
   ↓
Socket.IO
   ↓
initiator
```

If the offer arrives but no answer is produced, inspect:

```text
createPeer(from, false)
peer.signal(offer)
```

If the answer is produced but the initiator does not receive it, inspect the Socket.IO routing.

---

## 49. Debugging ICE

If offer and answer work but media still fails, inspect:

```text
ice-candidate
```

At this point the signaling layer may be functioning correctly while network connectivity is failing.

Possible causes include:

```text
NAT
firewall
network topology
STUN limitations
missing TURN relay
```

This is why a working signaling server does not guarantee working WebRTC media.

---

## 50. Debugging Remote Stream Rendering

If signaling and peer negotiation succeed but the remote video remains empty, inspect:

```text
peer.on("stream")
```

Expected:

```text
remoteStream
    ↓
remoteStreamsRef.set(socketId, remoteStream)
    ↓
setRemoteVideos(...)
    ↓
React render
    ↓
video.srcObject = remoteStream
```

A failure at any boundary can make the video appear missing even though the WebRTC connection itself exists.

---

## 51. Cleanup Invariants

A healthy room should maintain these invariants:

```text
Every active participant
    → one socket registration

Every remote participant
    → one Peer.Instance

Every active remote peer
    → one remote MediaStream when media is available
```

When a participant leaves:

```text
socket
    ↓
participant state removed

peer
    ↓
destroyed

remote stream
    ↓
removed

React UI
    ↓
updated
```

Cleanup is therefore part of the architecture, not merely housekeeping.

---

## 52. Important Current Limitations

The current realtime architecture has known limitations.

### TURN

The code demonstrates STUN but not a complete TURN setup.

### Mesh scaling

Every participant maintains peer connections to other participants.

### In-memory room state

`rooms` and `users` live inside the backend process.

### Realtime authentication

The documented `join-room` flow does not demonstrate a separate Clerk token validation layer during the Socket.IO handshake.

### Single-process assumptions

Scaling the Socket.IO layer horizontally would require shared realtime coordination.

These are current architectural boundaries, not reasons to misrepresent the system.

---

## 53. Why REST Is Not Used for WebRTC Signaling

REST is suitable for request/response operations such as:

```text
GET session
GET session actions
POST file
DELETE session
```

WebRTC signaling is different.

The system needs fast bidirectional event delivery for:

```text
offer
answer
ice-candidate
user-connected
user-disconnected
```

Socket.IO is therefore a more natural fit for the signaling channel.

The same connection can also carry the application's other realtime events.

---

## 54. Why Socket.IO Does Not Replace WebRTC

It would be technically possible to send arbitrary binary data through a websocket, but that does not make Socket.IO a WebRTC replacement.

The current architecture intentionally uses:

```text
Socket.IO
    → signaling / application events

WebRTC
    → real-time media transport
```

WebRTC provides browser-native mechanisms for media transport, peer connectivity, encryption, codecs, congestion control, and related realtime media behavior.

The project therefore uses each technology for the responsibility it is designed to handle.

---

## 55. Complete Technical Chain

The entire video communication feature can be reduced to:

```text
User opens /room/:roomId
        ↓
getUserMedia()
        ↓
MediaStream
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
simple-peer
        ↓
signal event
        ↓
offer / answer / ICE
        ↓
Socket.IO signaling
        ↓
peer.signal(...)
        ↓
WebRTC negotiation
        ↓
WebRTC connection
        ↓
peer.on("stream")
        ↓
remote MediaStream
        ↓
remoteStreamsRef
        ↓
remoteVideos
        ↓
React UI
```

This is the primary runtime chain.

---

## 56. Full System With Translation

When realtime translation is included:

```text
                         MediaStream
                              |
                 +------------+------------+
                 |                         |
                 v                         v
             simple-peer              AudioSender
                 |                         |
                 v                         v
              WebRTC                 audio-chunk
                 |                         |
                 v                         v
        Remote participants          Socket.IO
                                           |
                                           v
                                      Fastify
                                           |
                                           v
                                    SpeechService
                                           |
                                           v
                                    Python STT
                                           |
                                           v
                                        text
                                           |
                                           v
                                  TranslationService
                                           |
                                           v
                                    translatedText
                                           |
                                           v
                                       subtitle
                                           |
                                           v
                                      React UI
```

This diagram demonstrates why the video communication and translation features can share a microphone source without becoming one monolithic pipeline.

---

## 57. What a Developer Should Be Able to Explain

After studying this document, a developer should be able to explain:

1. How `getUserMedia()` creates the local `MediaStream`.
2. Why the same stream feeds both WebRTC and `AudioSender`.
3. Why Socket.IO is required even though WebRTC transports the actual media.
4. What `join-room` does.
5. What `rooms` and `users` contain.
6. Why the new participant receives `existing-users`.
7. Why existing participants receive `user-connected`.
8. Why `initiator` is `true` for the new participant.
9. What `simple-peer` abstracts.
10. How `offer` travels through Socket.IO.
11. How `answer` travels back.
12. What ICE candidates are doing.
13. What STUN contributes.
14. Why TURN is not equivalent to STUN.
15. Where the actual video travels.
16. How `remoteStream` reaches the React UI.
17. Why runtime refs and React state are separated.
18. How camera state is synchronized.
19. How screen sharing replaces the outgoing video track.
20. How peer cleanup works.
21. Why the current topology is mesh-like.
22. Why mesh becomes expensive with more participants.
23. How the translation branch is separate from WebRTC media transport.
24. How to debug the pipeline boundary by boundary.

---

## 58. A Strong Demonstration Answer

If asked:

> “How does your video communication work?”

A technically accurate short answer is:

> The browser first obtains a local `MediaStream` with the camera and microphone. I use `simple-peer` to create a WebRTC peer for each remote participant. Socket.IO is used only for signaling and realtime application events, so it transports the `offer`, `answer`, and ICE candidates between browsers. Once negotiation succeeds, the actual audio and video flow through WebRTC directly between peers. The remote `MediaStream` is then stored in runtime state and attached to a video element in React.

If asked:

> “Why do you need Socket.IO if you already use WebRTC?”

Answer:

> WebRTC handles the media connection, but the browsers still need a signaling channel to exchange the information required to establish that connection. In this project Socket.IO is that signaling channel. It also handles room events, chat, participant state, audio chunks, and subtitles.

If asked:

> “Where does the translation happen?”

Answer:

> The local microphone stream is also processed by a separate `AudioSender` pipeline. Audio is converted into chunks and sent through Socket.IO to the Fastify backend, which coordinates speech recognition and translation through the Python service. The resulting subtitle is sent back to the browser through Socket.IO. That pipeline is independent from the WebRTC media transport.

---

## 59. Final Mental Model

The entire subsystem can be remembered as four layers:

```text
1. CAPTURE
   getUserMedia()
       ↓
   MediaStream

2. MEDIA
   simple-peer
       ↓
   WebRTC
       ↓
   remote audio/video

3. COORDINATION
   Socket.IO
       ↓
   room events
   signaling
   participant state

4. INTELLIGENCE
   AudioSender
       ↓
   audio-chunk
       ↓
   STT
       ↓
   translation
       ↓
   subtitle
```

The most important sentence to remember is:

> Socket.IO coordinates the realtime system, WebRTC carries the actual media, and the translation pipeline independently processes microphone audio through the backend and Python ML services.

Once that distinction is understood, the rest of the implementation stops looking like a pile of hooks and event names and becomes a set of clearly separated runtime pipelines.
