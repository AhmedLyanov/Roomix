# Merriweather — Project Overview

## 1. What is Merriweather?

Merriweather is a real-time communication platform built around live video sessions.

The project combines:

- real-time video and audio communication;
- real-time speech recognition and translation;
- persistent session history;
- participant tracking;
- session action history;
- real-time chat;
- file sharing;
- authentication;
- a modular frontend and backend architecture.

The main technical goal of the project is not simply to build a video call UI. It is to demonstrate how several real-time systems can work together:

```text
User
 │
 ▼
Merriweather Room
 │
 ├── WebRTC
 │    └── live audio/video
 │
 ├── Socket.IO
 │    ├── WebRTC signaling
 │    ├── participant events
 │    ├── chat events
 │    └── realtime translation pipeline
 │
 ├── Translation Pipeline
 │    ├── audio capture
 │    ├── speech recognition
 │    ├── language routing
 │    └── translation
 │
 └── Session System
      ├── session lifecycle
      ├── participants
      └── action history
```

---

## 2. Main Features

### 2.1 Real-time video communication

Participants can enter the same room and establish WebRTC peer-to-peer connections.

The project uses:

- `simple-peer`;
- WebRTC;
- Socket.IO for signaling;
- browser `MediaStream` APIs.

Socket.IO does not transport the actual video stream. It is used to exchange the signaling information required to establish WebRTC connections.

After negotiation, media is transported through WebRTC.

---

### 2.2 Real-time speech translation

One of the main features of Merriweather is real-time speech translation between:

```text
Russian ↔ English
```

The system captures the speaker's audio, processes it, sends audio chunks through the realtime layer, converts speech to text, determines which listeners need translation, translates the recognized text when necessary, and sends subtitles back to the appropriate participants.

Conceptually:

```text
Microphone
    ↓
Audio processing
    ↓
Audio chunks
    ↓
Socket.IO
    ↓
Speech recognition
    ↓
Recognized text
    ↓
Listener language grouping
    ↓
Translation when required
    ↓
Subtitle event
    ↓
Participant UI
```

This feature is intentionally treated as a separate pipeline from the WebRTC media transport.

The audio used for translation is therefore not the same thing as the WebRTC video/audio transport. The project can use the local audio stream for both purposes while processing a separate copy of the audio for speech recognition.

---

### 2.3 Persistent sessions

A room represents the current realtime communication state.

A session represents the persistent history of that communication.

The distinction is:

```text
Room
    = realtime state

Session
    = persistent historical record
```

A session stores information such as:

- room ID;
- owner;
- start time;
- end time;
- duration;
- participants.

The backend creates a session when the first participant enters an active room.

---

### 2.4 Session action history

Important events inside a session are represented as `SessionAction` records.

Supported action types include:

```text
SESSION_STARTED
SESSION_ENDED
PARTICIPANT_JOINED
PARTICIPANT_LEFT
FILE_UPLOADED
MESSAGE_SENT
SCREEN_SHARED
```

An action can also contain metadata.

For example, a file upload action can store:

```text
fileName
fileSize
mimeType
messageId
```

This allows the frontend to present a chronological session history rather than reconstructing history from unrelated database collections.

---

### 2.5 Real-time chat

Room chat is implemented through Socket.IO and persisted in MongoDB through `RoomMessage`.

Text messages and uploaded files are represented as room messages.

File uploads additionally create a `FILE_UPLOADED` session action when an active session exists.

---

## 3. High-Level Architecture

Merriweather is split into several major layers.

```text
                    Frontend
                       │
              ┌────────┴────────┐
              │                 │
          Next.js            Socket.IO
              │                 │
              │                 ▼
              │             Fastify
              │                 │
              │       ┌─────────┼─────────┐
              │       │         │         │
              │    Sessions    Chat    Translation
              │       │         │         │
              │       └─────────┴─────────┘
              │                 │
              │              MongoDB
              │
              └──── WebRTC ─────┘
```

The frontend is responsible for the browser-side application and realtime room state.

The Fastify backend provides HTTP APIs and the Socket.IO realtime server.

MongoDB stores persistent application data.

The translation pipeline connects realtime audio processing with speech recognition and translation services.

---

## 4. Frontend

The frontend is built around Next.js and React.

Important responsibilities include:

- rendering rooms and sessions;
- obtaining browser media streams;
- managing WebRTC peers;
- communicating through Socket.IO;
- displaying remote streams;
- controlling microphone and camera state;
- displaying translated subtitles;
- loading session history;
- rendering chat and files.

The room logic is composed through hooks such as:

```text
useMedia
usePeer
useSocket
useRoomSession
useMediaControls
```

The purpose of this separation is to prevent one component from becoming responsible for the entire realtime system.

For example:

```text
useMedia
    ↓
MediaStream

usePeer
    ↓
WebRTC connections

useSocket
    ↓
Socket.IO + signaling

useRoomSession
    ↓
orchestration
```

---

## 5. Backend

The backend uses Fastify.

Its responsibilities include:

- REST API endpoints;
- authentication middleware;
- Socket.IO server;
- room runtime state;
- WebRTC signaling;
- session lifecycle;
- session actions;
- chat persistence;
- file uploads;
- communication with speech and translation services.

The websocket layer maintains temporary runtime state using Maps:

```text
rooms
users
```

This state represents currently connected users.

Persistent history is stored separately in MongoDB.

---

## 6. Data Persistence

MongoDB is used for persistent application data.

Important models include:

```text
User
Session
SessionAction
RoomMessage
```

The relationship between the main concepts is approximately:

```text
User
 │
 ├──────────────┐
 │              │
 ▼              ▼
Session      RoomMessage
 │
 ▼
SessionAction
```

A Session owns its historical actions through `sessionId`.

Room messages belong to a room through `roomId`.

This keeps realtime room data and persistent session history conceptually separate.

---

## 7. Authentication

The frontend uses Clerk for user authentication.

Authenticated HTTP requests are protected through backend authentication middleware where required.

The authenticated user identity is used by backend services when creating or modifying persistent data.

The realtime websocket layer also receives the user's identity as part of the room join payload.

---

## 8. Realtime Architecture

There are two important realtime mechanisms in the project.

### Socket.IO

Used for:

- room membership;
- participant events;
- WebRTC signaling;
- chat events;
- audio chunks for translation;
- translated subtitle events;
- camera state;
- microphone state;
- language updates.

### WebRTC

Used for:

- actual live audio transport;
- actual live video transport;
- peer-to-peer media connections.

The distinction is critical:

```text
Socket.IO
    = signaling + realtime application events

WebRTC
    = media transport
```

---

## 9. WebRTC Architecture

When users enter the same room, the backend informs them about existing participants.

The frontend creates `simple-peer` instances.

The signaling sequence is:

```text
Offer
  ↓
Socket.IO
  ↓
Answer
  ↓
Socket.IO
  ↓
ICE candidates
  ↓
Socket.IO
  ↓
WebRTC connection
```

After the connection is established:

```text
Browser A
    ⇅
 WebRTC
    ⇅
Browser B
```

The remote `MediaStream` is stored on the frontend and exposed to the room UI.

The current architecture is a mesh topology, meaning each participant maintains a peer connection with other participants.

---

## 10. Translation Architecture

The translation system is one of the most technically important parts of Merriweather.

The system supports:

```text
Russian → English
English → Russian
```

A simplified pipeline is:

```text
Speaker microphone
       ↓
Audio processing
       ↓
PCM/audio chunks
       ↓
Socket.IO
       ↓
Speech recognition
       ↓
Text
       ↓
Determine speaker language
       ↓
Group listeners by language
       ↓
Translate only when necessary
       ↓
Emit subtitle
       ↓
Listener UI
```

If the speaker and listener use the same language, translation is unnecessary.

For example:

```text
Speaker: English

English listeners
    → original text

Russian listeners
    → translated text
```

This prevents unnecessary translation requests.

The same logic works in the opposite direction:

```text
Speaker: Russian

Russian listeners
    → original text

English listeners
    → translated text
```

---

## 11. Session Lifecycle

A typical session follows this lifecycle:

```text
Room opened
    ↓
First participant joins
    ↓
Session created
    ↓
SESSION_STARTED
    ↓
Other participants join
    ↓
PARTICIPANT_JOINED
    ↓
Messages / files / other actions
    ↓
Participants leave
    ↓
Room becomes empty
    ↓
Session finished
    ↓
endedAt + duration stored
```

This lifecycle is implemented on the backend.

The session history can later be retrieved independently of the live room.

---

## 12. Session History

The session page can retrieve:

```text
Session
+
Session Actions
+
Participants
+
Files
+
Chat
```

The action history is ordered chronologically by `createdAt`.

For example:

```text
12:01:25   Session Started
12:02:10   Participant Joined
12:05:42   File Uploaded
12:07:13   Participant Joined
12:20:54   Session Ended
```

This gives the project a persistent audit-like timeline of what happened during a session.

---

## 13. Important Architectural Distinctions

Several concepts should not be mixed together.

### Room vs Session

```text
Room
    temporary realtime state

Session
    persistent historical entity
```

### Socket.IO vs WebRTC

```text
Socket.IO
    signaling + application events

WebRTC
    media transport
```

### Participant vs MediaStream

```text
Participant
    identity + UI state

MediaStream
    audio/video data
```

### Session vs SessionAction

```text
Session
    the meeting itself

SessionAction
    something that happened during the meeting
```

### RoomMessage vs File

A file uploaded into a room is represented as a `RoomMessage` with file metadata.

A `FILE_UPLOADED` `SessionAction` records the fact that the upload happened as part of a session.

Therefore:

```text
RoomMessage
    = stored chat/file resource

SessionAction
    = historical event
```

---

## 14. Why the Project Exists

Merriweather is primarily a portfolio and engineering demonstration project.

Its purpose is to demonstrate the ability to design and implement a system involving:

- real-time communication;
- WebRTC;
- Socket.IO;
- asynchronous audio processing;
- speech recognition;
- translation;
- persistent session state;
- event history;
- authentication;
- file handling;
- frontend state orchestration;
- backend service separation.

The most technically significant feature is the realtime translation pipeline because it requires several asynchronous systems to cooperate:

```text
Browser audio
      ↓
Audio processing
      ↓
Realtime transport
      ↓
Speech recognition
      ↓
Language routing
      ↓
Translation
      ↓
Realtime subtitle delivery
```

The project therefore demonstrates more than standard CRUD application development.

---

## 15. Documentation Structure

The project documentation is organized into separate documents so each subsystem can be understood independently.

Planned documentation:

```text
docs/
│
├── 01-project-overview.md
├── 02-room-and-webrtc.md
├── 03-realtime-translation.md
├── 04-session-system.md
├── 05-session-history.md
├── 06-chat-and-file-sharing.md
├── 07-frontend-architecture.md
├── 08-backend-architecture.md
└── 09-development-and-deployment.md
```

The most important documents for understanding the project's engineering depth are:

```text
02-room-and-webrtc.md
03-realtime-translation.md
04-session-system.md
```

Together they explain the three core technical ideas behind Merriweather:

```text
Real-time communication
        +
Real-time translation
        +
Persistent session history
```

---

## 16. Short Technical Summary

Merriweather is a Next.js + Fastify real-time communication platform using WebRTC for peer-to-peer media, Socket.IO for signaling and application-level realtime events, MongoDB for persistent data, and a speech/translation pipeline for Russian-English live subtitles.

The central architectural principle is separation of responsibilities:

```text
WebRTC
    → media

Socket.IO
    → signaling + realtime events

Fastify
    → backend API + realtime server

MongoDB
    → persistence

Speech service
    → speech recognition

Translation service
    → language conversion

Next.js / React
    → user interface + client orchestration
```

This separation makes the system easier to reason about, debug, and extend.
