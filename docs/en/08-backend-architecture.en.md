# Roomix— Backend Architecture

## 1. Document Purpose

This document describes the Roomixbackend architecture: the Fastify application structure, separation into routes, services, models, and plugins, HTTP API and Socket.IO operation, MongoDB access, and backend interaction with the realtime translation and session systems.

The main goal of the backend is not to keep all logic inside route handlers, but to separate responsibilities between layers.

Общая схема:

```text
Frontend
    |
    +---------------- HTTP / REST ----------------+
    |                                               |
    v                                               v
Axios                                         Socket.IO Client
    |                                               |
    v                                               v
Fastify Routes                                WebSocket Server
    |                                               |
    v                                               +--> Room State
Services                                            +--> Session Service
    |                                               +--> Speech Service
    v                                               +--> Translation Service
Mongoose                                            +--> WebRTC signaling
    |
    v
MongoDB
```

В этой архитектуре HTTP и realtime-канал существуют параллельно и решают разные задачи.

---

## 2. Main Backend Responsibilities

The backend is responsible for:

- HTTP API;
- authentication HTTP-запросов;
- session lifecycle;
- participant state;
- session action history;
- chat persistence;
- file upload;
- WebSocket communication;
- WebRTC signaling;
- audio chunk processing;
- speech-to-text orchestration;
- translation orchestration;
- MongoDB access.

The backend should not be treated as one monolithic handler for all of these responsibilities.

Instead, the logic is separated:

```text
Routes
   ↓
Services
   ↓
Models / Database
```

А realtime часть имеет отдельный вход:

```text
Socket.IO
   ↓
Services
```

---

## 3. Backend Structure

The main project structure is:

```text
server/
├── index.js
│
├── plugins/
│   ├── auth.js
│   └── websocket.js
│
├── routes/
│   ├── chat/
│   ├── sessions/
│   └── translation/
│
├── services/
│   ├── session.service.js
│   ├── session-action.service.js
│   ├── speech.service.js
│   └── translation.service.js
│
└── models/
    ├── Session.model.js
    ├── SessionAction.model.js
    ├── RoomMessage.model.js
    └── User.js
```

This is not merely file organization.

Each directory represents a separate architectural responsibility.

---

## 4. Application Entry Point

`server/index.js` is the backend entry point.

At the application level, it is responsible for:

```text
create Fastify app
      ↓
load environment
      ↓
configure CORS/plugins
      ↓
connect MongoDB
      ↓
register authentication
      ↓
register routes
      ↓
register WebSocket plugin
      ↓
start server
```

Therefore, `index.js` should handle application composition rather than the business logic of individual operations.

---

## 5. Why Fastify Is Used

Fastify acts as the HTTP boundary of the backend.

It provides:

- routing;
- request/response lifecycle;
- hooks;
- plugins;
- authentication integration;
- logging;
- Socket.IO integration;
- middleware-like `preHandler`.

Architecturally, Fastify sits between the frontend and business logic:

```text
Browser
   ↓
HTTP request
   ↓
Fastify
   ↓
Route
   ↓
Service
```

The frontend should not interact directly with MongoDB.

---

## 6. Routes

Routes are responsible for the HTTP boundary.

For example:

```text
GET /sessions/:userId
GET /sessions/details/:id
GET /sessions/:sessionId/actions
DELETE /sessions/:id
```

A route receives a request:

```js
const { sessionId } = request.params;
```

and passes the data to the service layer:

```js
return getSessionActions(sessionId);
```

A route handler should not implement all database and business logic itself.

Правильное разделение:

```text
Route
  =
HTTP input/output

Service
  =
business logic

Model
  =
database structure/query
```

---

## 7. Session Routes

Session routes are located in:

```text
routes/sessions/index.js
```

Main endpoints:

```text
GET /sessions/:userId
GET /sessions/details/:id
GET /sessions/:sessionId/actions
DELETE /sessions/:id
```

For example:

```js
fastify.get(
  "/:sessionId/actions",
  {
    preHandler: [fastify.authenticate],
  },
  async (request) => {
    const { sessionId } = request.params;

    return getSessionActions(sessionId);
  },
);
```

The route:

1. receives `sessionId`;
2. passes authentication;
3. calls the service;
4. returns the result.

---

## 8. Service Layer

The service layer contains the main business logic.

Key services:

```text
session.service.js
session-action.service.js
speech.service.js
translation.service.js
```

This prevents business rules from being placed inside route handlers or Socket.IO callbacks.

For example:

```text
join-room
    ↓
session.service
    ↓
createSession / joinParticipant
```

А не:

```text
join-room
    ↓
50 строк MongoDB operations
    ↓
session logic
    ↓
participant logic
    ↓
history logic
```

---

## 9. Session Service

`session.service.js` is responsible for the Session lifecycle.

Main operations:

```text
createSession()
joinParticipant()
updateParticipantLanguage()
leaveParticipant()
finishSession()
getSessions()
getSession()
deleteSession()
```

The main relationship is:

```text
roomId
   ↓
active Session
```

Session is a persisted MongoDB entity.

---

## 10. Creating a Session

When the first user enters a room, the WebSocket layer calls:

```js
createSession({
  roomId,
  ownerId,
  ownerName,
  ownerAvatar,
  language,
});
```

The service first checks whether an active Session exists:

```js
const existingSession = await Session.findOne({
  roomId,
  endedAt: { $exists: false },
});
```

If an active Session exists:

```js
return existingSession;
```

Otherwise, a new one is created:

```text
Session
    |
    +-- roomId
    +-- ownerId
    +-- ownerName
    +-- startedAt
    +-- participants
```

After the Session is created, the following action is created:

```text
SESSION_STARTED
```

через:

```js
createSessionAction(...)
```

---

## 11. Session Action Service

`session-action.service.js` is responsible for historical events.

Основные функции:

```text
createSessionAction()
getSessionActions()
```

Creation:

```js
await SessionAction.create({
  sessionId,
  type,
  userId,
  metadata,
});
```

Retrieval:

```js
SessionAction.find({
  sessionId,
}).sort({
  createdAt: 1,
});
```

Therefore, the history is stored separately from the main Session document.

---

## 12. Why SessionAction Is a Separate Collection

`Session` describes the meeting itself:

```text
Session
    =
meeting/session entity
```

`SessionAction` describes what happened inside it:

```text
SessionAction
    =
historical event
```

For example:

```text
Session
   |
   +-- startedAt
   +-- endedAt
   +-- participants
```

и отдельно:

```text
SessionAction
   |
   +-- SESSION_STARTED
   +-- PARTICIPANT_JOINED
   +-- FILE_UPLOADED
   +-- ...
```

This makes it possible to retrieve history separately without turning the Session document into a huge event log.

---

## 13. Session Model

`Session.model.js` represents the persisted session.

It stores information about:

```text
room
owner
start
end
duration
participants
```

A participant also stores:

```text
userId
userName
userAvatar
language
joinedAt
leftAt
```

This allows the Session to store both a summary of the meeting and participant information.

---

## 14. SessionAction Model

`SessionAction.model.js` defines:

```text
sessionId
type
userId
metadata
timestamps
```

Поддерживаемые типы:

```text
SESSION_STARTED
SESSION_ENDED
PARTICIPANT_JOINED
PARTICIPANT_LEFT
FILE_UPLOADED
MESSAGE_SENT
SCREEN_SHARED
```

`metadata` is a flexible object.

For example, for a file upload:

```text
fileName
fileSize
mimeType
messageId
```

This allows different action types to store different context.

---

## 15. WebSocket Plugin

The main realtime backend is located in:

```text
plugins/websocket.js
```

It creates the Socket.IO server:

```js
const io = new Server(fastify.server, {
  path: "/ws",
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
  },
});
```

After the Socket.IO server is created, connection handlers are registered.

---

## 16. Runtime Room State

The WebSocket layer uses two main structures:

```js
const rooms = new Map();
const users = new Map();
```

They exist in the process memory.

### `rooms`

Stores participants for specific rooms:

```text
roomId
   ↓
Map(socketId → participant)
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

Stores the mapping between a socket and an application user:

```text
socketId
   ↓
userId
userName
roomId
nativeLanguage
userAvatar
```

This is runtime state, not MongoDB persistence.

---

## 17. Runtime State vs Persistence

This is an important architectural distinction.

```text
rooms / users
    =
temporary runtime state
```

MongoDB:

```text
Session
SessionAction
RoomMessage
User
    =
persistent state
```

For example:

```text
cameraEnabled
```

может находиться в runtime participant state.

А:

```text
Session.startedAt
```

хранится в MongoDB.

Therefore, the backend separates:

```text
Realtime state
       +
Persistent state
```

---

## 18. `join-room` Lifecycle

When the client sends:

```text
join-room
```

the backend performs several operations.

Simplified:

```text
join-room
    ↓
socket.join(roomId)
    ↓
register participant
    ↓
register user/socket mapping
    ↓
send existing users
    ↓
broadcast user-connected
    ↓
create/retrieve Session
    ↓
joinParticipant if necessary
```

Таким образом один realtime event запускает несколько backend operations.

---

## 19. Session and WebSocket Integration

The Session lifecycle is connected to the Socket.IO lifecycle.

Первый участник:

```text
join-room
    ↓
createSession()
    ↓
SESSION_STARTED
```

Другой участник:

```text
join-room
    ↓
joinParticipant()
    ↓
PARTICIPANT_JOINED
```

When the last participant leaves:

```text
disconnect
    ↓
leaveParticipant()
    ↓
room empty
    ↓
finishSession()
```

This connects temporary Socket.IO room state with persistent Session history.

---

## 20. Disconnect Handling

On:

```text
socket.on("disconnect")
```

the the backend:

1. cleans up speech state;
2. gets the user by socket ID;
3. calls `leaveParticipant`;
4. removes the socket from the room;
5. if the room is empty, calls `finishSession`;
6. removes the room;
7. removes the user from `users`.

Схема:

```text
disconnect
    |
    +--> speech cleanup
    |
    +--> leaveParticipant
    |
    +--> remove socket
    |
    +--> room empty?
            |
            +--> yes → finishSession
```

Это один из ключевых lifecycle flows backend.

---

## 21. WebRTC Signaling

The backend does not transport the video itself.

The Socket.IO server only routes signaling messages:

```text
offer
answer
ice-candidate
```

For example:

```js
socket.on("offer", ({ offer, to }) => {
  io.to(to).emit("offer", {
    offer,
    from: socket.id,
  });
});
```

That means:

```text
Browser A
   ↓
Socket.IO
   ↓
Backend
   ↓
Socket.IO
   ↓
Browser B
```

After negotiation:

```text
Browser A <====== WebRTC ======> Browser B
```

This is an important separation of responsibilities.

---

## 22. Speech Service

`speech.service.js` handles audio chunks before they are sent to the external speech-to-text service.

The WebSocket layer receives:

```text
audio-chunk
```

and passes it to:

```js
speechService.addAudioChunk(...)
```

The The Speech service:

```text
audio chunks
     ↓
buffer
     ↓
pause / flush condition
     ↓
speech-to-text HTTP request
     ↓
recognized text
```

Therefore, the WebSocket plugin should not contain all audio-processing logic.

---

## 23. Translation Service

`translation.service.js` is the bridge between the Node.js backend and the Python translation service.

Its main role is:

```text
recognized text
      ↓
TranslationService
      ↓
Python HTTP API
      ↓
translated text
```

Node.js acts as the orchestration layer.

Python performs ML inference.

---

## 24. Node.js and Python Responsibilities

The architecture deliberately separates realtime orchestration from ML:

```text
Node.js
   =
realtime coordination
```

и:

```text
Python
   =
ML inference
```

Node.js:

```text
Socket.IO
SpeechService
TranslationService
room state
listener routing
subtitle delivery
```

Python:

```text
faster-whisper
MarianMT
```

This allows the ML implementation to be replaced independently of the Socket.IO architecture.

---

## 25. Realtime Translation Backend Flow

The complete backend flow:

```text
audio-chunk
     ↓
WebSocket
     ↓
SpeechService
     ↓
audio buffer
     ↓
/speech-to-text
     ↓
recognized text
     ↓
speaker language
     ↓
listenersByLanguage
     ↓
TranslationService
     ↓
/translate
     ↓
subtitle
     ↓
Socket.IO
```

The frontend receives:

```text
subtitle
```

и отображает результат.

---

## 26. Language Routing

The backend stores the participant language in runtime room state.

When recognized text arrives, the backend builds:

```text
listenersByLanguage
```

Conceptually:

```text
listenersByLanguage
    |
    +-- ru → [socketA, socketB]
    |
    +-- en → [socketC, socketD]
```

This avoids making a separate translation request for every user.

For example:

```text
Speaker: Russian

Listeners:
3 × Russian
2 × English
```

Backend может:

```text
Russian
   → no translation

English
   → one translation request
   → send result to both English listeners
```

---

## 27. Why the Backend Groups Listeners

Without grouping:

```text
English listener 1 → translate
English listener 2 → translate
English listener 3 → translate
```

With grouping:

```text
English
   ↓
one translation request
   ↓
same translated result
   ↓
listener 1
listener 2
listener 3
```

This reduces the number of external translation requests.

---

## 28. Translation Fallback

If the external translation service is unavailable, the realtime pipeline uses a fallback.

Instead of completely breaking subtitle delivery:

```text
translation error
      ↓
original text
      ↓
subtitle
```

This means the user may receive the original recognized text instead of a translation.

Это повышает resilience realtime pipeline.

---

## 29. Chat Backend

Text chat is also handled through Socket.IO.

The client sends:

```text
chat:send
```

The backend creates:

```js
RoomMessage.create({
  roomId,
  senderId,
  senderName,
  senderAvatar,
  text,
  type: "text",
});
```

After persistence, the backend sends:

```text
chat:new
```

to the room.

Схема:

```text
chat:send
    ↓
RoomMessage.create()
    ↓
MongoDB
    ↓
chat:new
    ↓
participants
```

---

## 30. File Upload Backend

File upload uses an HTTP route:

```text
POST /chat/:roomId/files
```

The the backend:

1. authenticates the user;
2. receives the multipart file;
3. creates the uploads directory;
4. generates a unique stored name;
5. writes the file to the filesystem;
6. creates a `RoomMessage`;
7. creates a `FILE_UPLOADED` action for the active Session;
8. emits `chat:new`.

Схема:

```text
HTTP multipart
     ↓
Fastify
     ↓
filesystem
     +
RoomMessage
     +
SessionAction
     ↓
chat:new
```

---

## 31. File Bytes vs Metadata

The physical file and its database representation are separated.

Physical resource:

```text
uploads/<storedName>
```

Database metadata:

```text
RoomMessage
   |
   +-- originalName
   +-- storedName
   +-- mimeType
   +-- size
   +-- url
```

Historical event:

```text
SessionAction
   |
   +-- FILE_UPLOADED
   +-- fileName
   +-- fileSize
   +-- mimeType
   +-- messageId
```

Therefore:

```text
File bytes
    =
filesystem

File metadata
    =
MongoDB

Historical event
    =
SessionAction
```

---

## 32. MongoDB Access

MongoDB is accessed by the backend through Mongoose.

The general path is:

```text
Route / WebSocket
       ↓
Service
       ↓
Mongoose Model
       ↓
MongoDB
```

For example:

```text
getSessionActions()
       ↓
SessionAction.find()
       ↓
MongoDB
```

The frontend does not work with MongoDB directly.

---

## 33. Models

Main models:

```text
User
Session
SessionAction
RoomMessage
```

Their responsibilities are different.

### `User`

Application user information.

### `Session`

Persistent meeting/session record.

### `SessionAction`

Historical event.

### `RoomMessage`

Chat/file resource persisted in MongoDB.

Схема:

```text
User
  |
  +-- owns/participates in Session
             |
             +-- SessionAction

Room
  |
  +-- RoomMessage
```

---

## 34. Authentication Boundary

HTTP routes use:

```js
preHandler: [fastify.authenticate];
```

For example:

```js
fastify.get(
  "/:sessionId/actions",
  {
    preHandler: [fastify.authenticate],
  },
  async (request) => {
    ...
  },
);
```

Flow:

```text
HTTP request
      ↓
fastify.authenticate
      |
      +-- invalid → reject
      |
      +-- valid → route
```

Clerk is the source of identity/authentication.

---

## 35. HTTP Authentication vs WebSocket Authentication

This is an important limitation of the current architecture.

HTTP routes are explicitly protected:

```text
preHandler
    ↓
fastify.authenticate
```

The current Socket.IO `join-room` flow does not show separate Clerk token validation during the handshake.

Therefore, it would be incorrect to say:

> "Все realtime connections полностью authenticated через Clerk."

A more accurate statement is:

> HTTP API имеет authentication middleware, а Socket.IO realtime connection в текущей реализации требует отдельного hardening/authentication layer.

Это важная архитектурная граница.

---

## 36. HTTP and Realtime Are Parallel Channels

Roomixuses two primary communication channels.

### HTTP

For:

```text
sessions
session details
session actions
file upload
translation HTTP integration
```

### Socket.IO

For:

```text
WebRTC signaling
participant events
chat realtime delivery
audio chunks
subtitles
camera state
microphone state
```

Схема:

```text
                 Frontend
                 /      \
                /        \
             HTTP       Socket.IO
              |             |
           Fastify      WebSocket
              |             |
           Services     realtime state
              |
           MongoDB
```

---

## 37. Why Services Matter

Without a service layer, the backend quickly turns into a collection of large route handlers.

For example:

```text
Route
 ├── authentication
 ├── validation
 ├── MongoDB query
 ├── business rules
 ├── participant logic
 ├── history
 ├── response formatting
 └── error handling
```

With services:

```text
Route
   ↓
Service
   ↓
Model
```

For example:

```text
GET /sessions/:id/actions
        ↓
getSessionActions()
        ↓
SessionAction.find()
```

This makes business logic easier to reuse.

---

## 38. Backend Error Handling

HTTP routes generally use `try/catch`.

Например file upload:

```text
try
   ↓
process file
   ↓
create message
   ↓
create action
   ↓
response
```

On error:

```text
catch
   ↓
log error
   ↓
500 response
```

Realtime callbacks используют аналогичный принцип:

```text
event
   ↓
try
   ↓
operation
   ↓
catch
   ↓
log
```

Errors from the external translation service additionally fall back to the original text.

---

## 39. Backend Responsibilities by Component

| Component                   | Responsibility                     |
| --------------------------- | ---------------------------------- |
| `index.js`                  | application composition/startup    |
| `auth.js`                   | HTTP authentication integration    |
| `websocket.js`              | Socket.IO + realtime orchestration |
| session routes              | HTTP session API                   |
| chat routes                 | messages and file upload           |
| `session.service.js`        | session lifecycle                  |
| `session-action.service.js` | session event persistence          |
| `speech.service.js`         | audio buffering + STT bridge       |
| `translation.service.js`    | translation bridge                 |
| `Session.model.js`          | session persistence model          |
| `SessionAction.model.js`    | action persistence model           |
| `RoomMessage.model.js`      | chat/file persistence model        |
| `User.js`                   | user persistence model             |

---

## 40. Full Backend Architecture

```text
                         Browser
                            |
                +-----------+-----------+
                |                       |
              Axios                 Socket.IO
                |                       |
                v                       v
             Fastify              WebSocket Plugin
                |                       |
        +-------+-------+       +-------+----------------+
        |               |       |       |        |       |
      Routes          Auth    Rooms  Sessions   Speech  WebRTC
        |                               |        |       signaling
        |                               |        |
        v                               v        v
     Services --------------------> Session  Translation
        |
        +------------------+
        |                  |
        v                  v
     Mongoose          External Python API
        |                  |
        v                  |
     MongoDB          ML inference
```

---

## 41. Complete Example: File Upload

One concrete backend flow demonstrates how several layers cooperate.

```text
POST /chat/:roomId/files
          ↓
Fastify route
          ↓
authenticate
          ↓
User.findOne()
          ↓
multipart file
          ↓
filesystem write
          ↓
RoomMessage.create()
          ↓
Session.findOne(active)
          ↓
createSessionAction()
          ↓
SessionAction.create()
          ↓
io.to(roomId).emit("chat:new")
          ↓
HTTP 201
```

This is a good example of why business logic is distributed between routes, services, models, filesystem and realtime delivery.

---

## 42. Complete Example: Creating a Session

```text
Socket.IO join-room
        ↓
websocket.js
        ↓
createSession()
        ↓
Session.findOne(active)
        |
        +-- exists → return existing
        |
        +-- not exists
              ↓
         Session.create()
              ↓
       createSessionAction()
              ↓
        SESSION_STARTED
```

The Session itself and its historical action are therefore created as separate persisted entities.

---

## 43. Complete Example: Joining a Participant

```text
join-room
    ↓
createSession()
    ↓
existing session
    ↓
ownerId !== current user
    ↓
joinParticipant()
    ↓
participants.push()
    ↓
session.save()
    ↓
createSessionAction()
    ↓
PARTICIPANT_JOINED
```

This keeps participant persistence and historical event creation in the session service.

---

## 44. Complete Example: Realtime Translation

```text
Browser
   |
   | audio-chunk
   v
Socket.IO
   |
   v
speechService.addAudioChunk()
   |
   v
audio buffer
   |
   v
Python /speech-to-text
   |
   v
recognized text
   |
   v
listenersByLanguage
   |
   +---- same language → original text
   |
   +---- different language
              ↓
       translationService
              ↓
       Python /translate
              ↓
        translated text
              ↓
          subtitle
              ↓
        Socket.IO emit
              ↓
           Browser
```

---

## 45. What the Backend Does Not Do

Several responsibilities deliberately remain outside backend persistence.

### WebRTC Media Transport

The backend handles signaling, not continuous video frames.

### UI Rendering

React owns the UI.

### Direct MongoDB Access from the Frontend

Not allowed by the architecture.

### ML Inference in Node.js

The current architecture delegates ML inference to Python.

The backend coordinates these systems rather than replacing them.

---

## 46. Important Architectural Boundaries

The project can be understood through the following boundaries:

```text
Fastify
    =
HTTP boundary

Socket.IO
    =
realtime boundary

Services
    =
business logic

Mongoose
    =
database access

MongoDB
    =
persistent storage

Python
    =
ML inference

WebRTC
    =
media transport

React
    =
UI/client orchestration
```

These boundaries are more important than the individual libraries.

---

## 47. Known Limitations

The documentation should describe the current implementation honestly.

### Runtime State Is in Memory

`rooms` and `users` are JavaScript Maps.

Therefore, they belong to one backend process and are not automatically shared between multiple backend instances.

### Socket.IO Authentication Needs Hardening

HTTP routes use Clerk authentication, but the shown Socket.IO flow does not validate the Clerk token during connection/join.

### Session Creation Can Be Vulnerable to Concurrent Creation

A simple:

```text
find active session
    ↓
if none
    ↓
create
```

is not an atomic distributed lock.

Concurrent joins can therefore create duplicate sessions if they pass the lookup before either creation becomes visible.

### WebRTC Uses a Peer-to-Peer Mesh

This is appropriate for small rooms but does not scale like an SFU architecture.

### TURN Is Not Demonstrated

The current WebRTC configuration includes STUN but does not show a TURN relay.

These are engineering limitations, not reasons to hide the architecture.

---

## 48. How to Explain the Backend During a Demonstration

A concise explanation:

> The backend is built with Fastify and is split into routes, services, models, and plugins. REST routes handle persisted request/response operations, while Socket.IO handles realtime communication and WebRTC signaling. Business logic is placed in services such as `session.service`, `session-action.service`, `speech.service`, and `translation.service`. MongoDB is accessed through Mongoose models. The WebSocket plugin keeps temporary room state in memory and coordinates sessions, participants, speech processing, translation, chat, and WebRTC signaling.

---

## 49. Questions That Should Be Answerable After Studying This Document

A developer should be able to explain:

1. Why Fastify is used.
2. What the route layer is responsible for.
3. Why services exist.
4. What the models represent.
5. Where MongoDB access happens.
6. How a Session is created.
7. How `SessionAction` is created.
8. How Socket.IO connects to the Session service.
9. What `rooms` and `users` contain.
10. Why runtime state and MongoDB state are separate.
11. How WebRTC signaling reaches another browser.
12. How audio chunks reach `SpeechService`.
13. How speech recognition is delegated to Python.
14. How translation is delegated to Python.
15. How listeners are grouped by language.
16. Why one translation can be reused for several listeners.
17. How chat messages are persisted.
18. How files are stored.
19. Why `RoomMessage` and `SessionAction` are different.
20. Where HTTP authentication is applied.
21. Why HTTP authentication and Socket.IO authentication are separate boundaries.
22. What happens when the last participant disconnects.
23. Which parts of the system are persistent.
24. Which parts are only runtime state.
25. What the current backend limitations are.

---

## 50. Final Architecture Summary

The backend can be reduced to five major responsibilities:

```text
HTTP API
    ↓
request/response operations

Realtime server
    ↓
Socket.IO events + signaling

Business services
    ↓
session / speech / translation logic

Persistence
    ↓
Mongoose + MongoDB

External ML
    ↓
Python speech + translation
```

The most important principle is separation of responsibilities:

```text
Routes
    → receive requests

Services
    → decide what the application should do

Models
    → define and persist data

Socket.IO
    → coordinate realtime events

Python
    → perform ML inference

MongoDB
    → persist application state
```

This separation is what allows Roomixto combine ordinary API operations with WebRTC, realtime translation, session history, chat, and file sharing without putting the entire application into one giant server module.
