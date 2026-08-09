# Merriweather — Backend Architecture

## 1. Назначение документа

Этот документ описывает backend-архитектуру Merriweather: структуру Fastify-приложения, разделение на routes, services, models и plugins, работу HTTP API и Socket.IO, доступ к MongoDB, а также взаимодействие backend с realtime translation и session system.

Главная цель backend — не содержать всю логику в route handlers, а разделять ответственность между слоями.

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

## 2. Основные обязанности backend

Backend отвечает за:

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
- orchestration speech-to-text;
- orchestration translation;
- доступ к MongoDB.

Backend не должен быть представлен как единый монолитный обработчик всех этих задач.

Вместо этого логика разделена:

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

## 3. Backend structure

Основная структура проекта:

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

Это не просто организация файлов.

Каждая директория представляет отдельный architectural responsibility.

---

## 4. Application entry point

`server/index.js` является точкой запуска backend.

На уровне приложения необходимо:

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

Таким образом, `index.js` должен заниматься composition приложения, а не бизнес-логикой отдельных функций.

---

## 5. Почему используется Fastify

Fastify выполняет роль HTTP boundary backend.

Он предоставляет:

- routing;
- request/response lifecycle;
- hooks;
- plugins;
- authentication integration;
- logging;
- integration with Socket.IO;
- middleware-like `preHandler`.

Архитектурно Fastify находится между frontend и business logic:

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

Frontend не должен напрямую взаимодействовать с MongoDB.

---

## 6. Routes

Routes отвечают за HTTP boundary.

Например:

```text
GET /sessions/:userId
GET /sessions/details/:id
GET /sessions/:sessionId/actions
DELETE /sessions/:id
```

Route получает request:

```js
const { sessionId } = request.params;
```

и передаёт данные service layer:

```js
return getSessionActions(sessionId);
```

Route handler не должен самостоятельно реализовывать всю database/business logic.

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

## 7. Session routes

Session routes находятся в:

```text
routes/sessions/index.js
```

Основные endpoints:

```text
GET /sessions/:userId
GET /sessions/details/:id
GET /sessions/:sessionId/actions
DELETE /sessions/:id
```

Например:

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

Route:

1. получает `sessionId`;
2. проходит authentication;
3. вызывает service;
4. возвращает результат.

---

## 8. Service layer

Service layer содержит основную business logic.

Ключевые сервисы:

```text
session.service.js
session-action.service.js
speech.service.js
translation.service.js
```

Это позволяет не помещать бизнес-правила внутрь route handlers или Socket.IO callbacks.

Например:

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

## 9. Session service

`session.service.js` отвечает за lifecycle Session.

Основные операции:

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

Главная связь:

```text
roomId
   ↓
active Session
```

Session является persisted сущностью MongoDB.

---

## 10. Creating a session

Когда первый пользователь входит в room, WebSocket layer вызывает:

```js
createSession({
  roomId,
  ownerId,
  ownerName,
  ownerAvatar,
  language,
});
```

Service сначала проверяет наличие активной Session:

```js
const existingSession = await Session.findOne({
  roomId,
  endedAt: { $exists: false },
});
```

Если активная Session существует:

```js
return existingSession;
```

Иначе создаётся новая:

```text
Session
    |
    +-- roomId
    +-- ownerId
    +-- ownerName
    +-- startedAt
    +-- participants
```

После создания Session создаётся:

```text
SESSION_STARTED
```

через:

```js
createSessionAction(...)
```

---

## 11. Session Action service

`session-action.service.js` отвечает за исторические события.

Основные функции:

```text
createSessionAction()
getSessionActions()
```

Создание:

```js
await SessionAction.create({
  sessionId,
  type,
  userId,
  metadata,
});
```

Получение:

```js
SessionAction.find({
  sessionId,
}).sort({
  createdAt: 1,
});
```

Таким образом, история хранится отдельно от основной Session document.

---

## 12. Why SessionAction is a separate collection

`Session` описывает саму встречу:

```text
Session
    =
meeting/session entity
```

`SessionAction` описывает то, что произошло внутри неё:

```text
SessionAction
    =
historical event
```

Например:

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

Это позволяет получать историю отдельно и не превращать Session document в огромный event log.

---

## 13. Session model

`Session.model.js` представляет persisted session.

В ней хранится информация о:

```text
room
owner
start
end
duration
participants
```

Participant также хранит:

```text
userId
userName
userAvatar
language
joinedAt
leftAt
```

Это позволяет Session одновременно хранить summary состояния встречи и информацию о её участниках.

---

## 14. SessionAction model

`SessionAction.model.js` определяет:

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

`metadata` является гибким объектом.

Например для file upload:

```text
fileName
fileSize
mimeType
messageId
```

Это позволяет разным action types хранить различный контекст.

---

## 15. WebSocket plugin

Основной realtime backend находится в:

```text
plugins/websocket.js
```

Он создаёт Socket.IO server:

```js
const io = new Server(fastify.server, {
  path: "/ws",
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
  },
});
```

После создания Socket.IO server регистрируются connection handlers.

---

## 16. Runtime room state

WebSocket layer использует две основные структуры:

```js
const rooms = new Map();
const users = new Map();
```

Они находятся в памяти процесса.

### `rooms`

Хранит участников конкретных комнат:

```text
roomId
   ↓
Map(socketId → participant)
```

Participant содержит:

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

Хранит связь socket с application user:

```text
socketId
   ↓
userId
userName
roomId
nativeLanguage
userAvatar
```

Это runtime state, а не MongoDB persistence.

---

## 17. Runtime state vs persistence

Это важное архитектурное различие.

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

Например:

```text
cameraEnabled
```

может находиться в runtime participant state.

А:

```text
Session.startedAt
```

хранится в MongoDB.

Таким образом backend разделяет:

```text
Realtime state
       +
Persistent state
```

---

## 18. `join-room` lifecycle

Когда клиент отправляет:

```text
join-room
```

backend выполняет несколько операций.

Упрощённо:

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

## 19. Session and WebSocket integration

Session lifecycle связан с Socket.IO lifecycle.

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

Последний участник выходит:

```text
disconnect
    ↓
leaveParticipant()
    ↓
room empty
    ↓
finishSession()
```

Это связывает временное состояние Socket.IO room с постоянной историей Session.

---

## 20. Disconnect handling

При:

```text
socket.on("disconnect")
```

backend:

1. очищает speech state;
2. получает пользователя по socket ID;
3. вызывает `leaveParticipant`;
4. удаляет socket из room;
5. если room пустой, вызывает `finishSession`;
6. удаляет room;
7. удаляет пользователя из `users`.

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

## 21. WebRTC signaling

Backend не передаёт само видео.

Socket.IO server только маршрутизирует signaling messages:

```text
offer
answer
ice-candidate
```

Например:

```js
socket.on("offer", ({ offer, to }) => {
  io.to(to).emit("offer", {
    offer,
    from: socket.id,
  });
});
```

То есть:

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

После negotiation:

```text
Browser A <====== WebRTC ======> Browser B
```

Это важное разделение ответственности.

---

## 22. Speech service

`speech.service.js` отвечает за обработку audio chunks перед отправкой во внешний speech-to-text service.

WebSocket layer получает:

```text
audio-chunk
```

и передаёт его:

```js
speechService.addAudioChunk(...)
```

Speech service:

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

Таким образом WebSocket plugin не должен содержать всю логику обработки аудио.

---

## 23. Translation service

`translation.service.js` является bridge между Node.js backend и Python translation service.

Основная роль:

```text
recognized text
      ↓
TranslationService
      ↓
Python HTTP API
      ↓
translated text
```

Node.js выступает orchestration layer.

Python выполняет ML inference.

---

## 24. Node.js and Python responsibilities

Архитектура сознательно разделяет realtime orchestration и ML:

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

Это позволяет заменить ML implementation независимо от Socket.IO architecture.

---

## 25. Realtime translation backend flow

Полный backend flow:

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

Frontend получает:

```text
subtitle
```

и отображает результат.

---

## 26. Language routing

Backend хранит language participant в runtime room state.

Когда приходит распознанный текст, backend создаёт:

```text
listenersByLanguage
```

Концептуально:

```text
listenersByLanguage
    |
    +-- ru → [socketA, socketB]
    |
    +-- en → [socketC, socketD]
```

Это позволяет не делать отдельный translation request для каждого пользователя.

Например:

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

## 27. Why backend groups listeners

Без grouping:

```text
English listener 1 → translate
English listener 2 → translate
English listener 3 → translate
```

С grouping:

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

Это уменьшает количество внешних translation requests.

---

## 28. Translation fallback

Если внешний translation service недоступен, realtime pipeline использует fallback.

Вместо того чтобы полностью ломать subtitle delivery:

```text
translation error
      ↓
original text
      ↓
subtitle
```

То есть пользователь может получить оригинальный recognized text вместо перевода.

Это повышает resilience realtime pipeline.

---

## 29. Chat backend

Text chat также обрабатывается через Socket.IO.

Клиент отправляет:

```text
chat:send
```

Backend создаёт:

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

После persistence backend отправляет:

```text
chat:new
```

в room.

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

## 30. File upload backend

File upload использует HTTP route:

```text
POST /chat/:roomId/files
```

Backend:

1. аутентифицирует пользователя;
2. получает multipart file;
3. создаёт uploads directory;
4. генерирует unique stored name;
5. записывает файл на filesystem;
6. создаёт `RoomMessage`;
7. создаёт `FILE_UPLOADED` action для active Session;
8. отправляет `chat:new`.

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

## 31. File bytes vs metadata

Физический файл и его database representation разделены.

Физический ресурс:

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

Историческое событие:

```text
SessionAction
   |
   +-- FILE_UPLOADED
   +-- fileName
   +-- fileSize
   +-- mimeType
   +-- messageId
```

Поэтому:

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

## 32. MongoDB access

MongoDB доступен backend через Mongoose.

Общий путь:

```text
Route / WebSocket
       ↓
Service
       ↓
Mongoose Model
       ↓
MongoDB
```

Например:

```text
getSessionActions()
       ↓
SessionAction.find()
       ↓
MongoDB
```

Frontend не работает с MongoDB напрямую.

---

## 33. Models

Основные модели:

```text
User
Session
SessionAction
RoomMessage
```

Их ответственность различается.

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

## 34. Authentication boundary

HTTP routes используют:

```js
preHandler: [fastify.authenticate]
```

Например:

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

Clerk является источником identity/authentication.

---

## 35. HTTP authentication vs WebSocket authentication

Это важное ограничение текущей архитектуры.

HTTP routes явно защищаются:

```text
preHandler
    ↓
fastify.authenticate
```

Socket.IO `join-room` flow в текущей реализации не показывает отдельную Clerk token validation на handshake.

Поэтому нельзя говорить:

> "Все realtime connections полностью authenticated через Clerk."

Корректнее:

> HTTP API имеет authentication middleware, а Socket.IO realtime connection в текущей реализации требует отдельного hardening/authentication layer.

Это важная архитектурная граница.

---

## 36. HTTP and realtime are parallel channels

Merriweather использует два основных канала.

### HTTP

Для:

```text
sessions
session details
session actions
file upload
translation HTTP integration
```

### Socket.IO

Для:

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

## 37. Why services matter

Без service layer backend быстро превращается в набор больших route handlers.

Например:

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

С services:

```text
Route
   ↓
Service
   ↓
Model
```

Например:

```text
GET /sessions/:id/actions
        ↓
getSessionActions()
        ↓
SessionAction.find()
```

Это упрощает повторное использование business logic.

---

## 38. Backend error handling

HTTP routes обычно используют `try/catch`.

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

При ошибке:

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

Ошибки внешнего translation service дополнительно имеют fallback к original text.

---

## 39. Backend responsibilities by component

| Component | Responsibility |
|---|---|
| `index.js` | application composition/startup |
| `auth.js` | HTTP authentication integration |
| `websocket.js` | Socket.IO + realtime orchestration |
| session routes | HTTP session API |
| chat routes | messages and file upload |
| `session.service.js` | session lifecycle |
| `session-action.service.js` | session event persistence |
| `speech.service.js` | audio buffering + STT bridge |
| `translation.service.js` | translation bridge |
| `Session.model.js` | session persistence model |
| `SessionAction.model.js` | action persistence model |
| `RoomMessage.model.js` | chat/file persistence model |
| `User.js` | user persistence model |

---

## 40. Full backend architecture

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

## 41. Complete example: file upload

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

## 42. Complete example: creating a session

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

## 43. Complete example: joining a participant

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

## 44. Complete example: realtime translation

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

## 45. What backend does not do

Several responsibilities deliberately remain outside backend persistence.

### WebRTC media transport

Backend handles signaling, not continuous video frames.

### UI rendering

React owns UI.

### Direct MongoDB access from frontend

Not allowed by architecture.

### ML inference in Node.js

Current architecture delegates ML inference to Python.

The backend coordinates these systems rather than replacing them.

---

## 46. Important architectural boundaries

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

## 47. Known limitations

Documentation should describe the current implementation honestly.

### Runtime state is in memory

`rooms` and `users` are JavaScript Maps.

Therefore they belong to one backend process and are not shared automatically between multiple backend instances.

### Socket.IO authentication needs hardening

HTTP routes use Clerk authentication, but the shown Socket.IO flow does not validate the Clerk token during connection/join.

### Session creation can be vulnerable to concurrent creation

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

### WebRTC uses a peer-to-peer mesh

This is appropriate for small rooms but does not scale like an SFU architecture.

### TURN is not demonstrated

The current WebRTC configuration includes STUN but does not show a TURN relay.

These are engineering limitations, not reasons to hide the architecture.

---

## 48. How to explain the backend during a demonstration

A concise explanation:

> The backend is built with Fastify and is split into routes, services, models, and plugins. REST routes handle persisted request/response operations, while Socket.IO handles realtime communication and WebRTC signaling. Business logic is placed in services such as `session.service`, `session-action.service`, `speech.service`, and `translation.service`. MongoDB is accessed through Mongoose models. The WebSocket plugin keeps temporary room state in memory and coordinates sessions, participants, speech processing, translation, chat, and WebRTC signaling.

---

## 49. Questions that should be answerable after studying this document

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

## 50. Final architecture summary

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

This separation is what allows Merriweather to combine ordinary API operations with WebRTC, realtime translation, session history, chat, and file sharing without putting the entire application into one giant server module.
