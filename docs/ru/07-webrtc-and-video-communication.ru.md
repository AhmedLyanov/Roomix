# Merriweather — WebRTC и видеосвязь

## 1. Назначение документа

Видеосвязь является одной из центральных realtime-функций Merriweather.

Пользователь входит в комнату, предоставляет браузеру доступ к камере и микрофону, после чего приложение создаёт WebRTC-соединения с другими участниками и получает их удалённые `MediaStream`.

Главное архитектурное разделение:

```text
Socket.IO
    → signaling и realtime application events

WebRTC
    → фактическая передача audio/video
```

Socket.IO не передаёт сам видеопоток. Он используется как signaling transport, через который браузеры обмениваются информацией, необходимой для установления WebRTC-соединения.

После успешной WebRTC negotiation:

```text
Browser A <====================> Browser B
             MediaStream
           audio + video
```

---

## 2. Используемые технологии

Система видеосвязи использует:

- browser `MediaStream`;
- WebRTC;
- `simple-peer`;
- Socket.IO client/server;
- STUN для ICE network discovery;
- React hooks для управления lifecycle комнаты, peers и remote streams.

Создание peer выполняется концептуально следующим образом:

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

Это означает:

- локальный `MediaStream` передаётся каждому peer;
- включён `trickle ICE`;
- используется STUN;
- TURN в текущей реализации не настроен.

---

## 3. Основные frontend-модули

WebRTC-логика распределена между несколькими hooks.

### `useMedia`

Получает локальный `MediaStream`:

```text
camera track
microphone track
       |
       v
   MediaStream
```

Этот stream используется сразу в двух независимых направлениях:

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

То есть видеосвязь и realtime translation используют один источник аудио, но обрабатывают его разными pipeline.

### `usePeer`

Отвечает за WebRTC peer connections.

Основные runtime-структуры:

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

`remoteVideos` является React state, необходимым UI для перерисовки.

### `useSocket`

Управляет Socket.IO и signaling:

- `join-room`;
- `existing-users`;
- `user-connected`;
- `offer`;
- `answer`;
- `ice-candidate`;
- `user-disconnected`.

### `useRoomSession`

Объединяет эти части:

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

Компонент комнаты работает с более высоким уровнем абстракции:

```text
stream
remoteVideos
participants
disconnect
```

---

## 4. Вход пользователя в комнату

Комната имеет URL:

```text
/room/:roomId
```

При входе:

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

Socket создаётся через:

```ts
io(process.env.NEXT_PUBLIC_SIGNALING_URL!, {
  path: "/ws",
  transports: ["websocket"],
  forceNew: true,
});
```

После подключения клиент отправляет:

```ts
socket.emit("join-room", {
  roomId,
  userId,
  userName,
  nativeLanguage,
  userAvatar,
});
```

Backend после получения `join-room`:

1. добавляет socket в Socket.IO room;
2. сохраняет runtime participant;
3. отправляет новому пользователю список существующих участников;
4. уведомляет существующих участников;
5. создаёт или возвращает активную Session.

---

## 5. Runtime state на backend

WebSocket server хранит две основные `Map`.

### `rooms`

Концептуально:

```text
rooms
  |
  +-- roomId
       |
       +-- socketId
            |
            +-- participant
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

Вторая Map связывает socket с application-level user:

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

Ответственность:

```text
rooms
  → участники конкретной комнаты

users
  → информация, связанная с socket
```

`users` особенно полезна для быстрого определения пользователя по `socket.id` во время последующих событий.

---

## 6. Обнаружение существующих участников

Когда новый пользователь входит, backend формирует список:

```text
existingUsers
```

и отправляет:

```text
existing-users
```

Новому клиенту.

Концептуально:

```text
New user
   ↓
existing-users
   ↓
for each existing user
   ↓
createPeer(socketId, true)
```

`true` означает, что новый клиент становится WebRTC initiator для данного peer.

---

## 7. Уведомление существующих участников

Одновременно backend отправляет уже подключённым пользователям:

```text
user-connected
```

Они создают peer:

```text
createPeer(socketId, false)
```

Таким образом:

```text
New participant
    → initiator = true

Existing participant
    → initiator = false
```

Это даёт каждой паре peers понятное направление negotiation.

---

## 8. Mesh topology

В текущей реализации каждый участник создаёт отдельный `simple-peer` для каждого другого участника.

Для трёх пользователей:

```text
Ahmed ↔ Ali
Ahmed ↔ John
Ali   ↔ John
```

У Ahmed:

```text
Ahmed
  |
  +-- Peer(Ali)
  |
  +-- Peer(John)
```

Поэтому текущая архитектура является mesh-like peer-to-peer topology, а не SFU/MCU.

Количество соединений растёт вместе с количеством участников:

```text
N × (N - 1) / 2
```

Например:

```text
2 users → 1 connection
3 users → 3 connections
4 users → 6 connections
5 users → 10 connections
```

Для небольших комнат это удобно и достаточно просто.

Для больших конференций такой подход масштабируется плохо, поэтому production-системы часто используют SFU.

---

## 9. `peersRef`

В frontend peer connections хранятся в:

```ts
useRef<Map<string, Peer.Instance>>(new Map());
```

Ключ:

```text
socketId
```

Значение:

```text
Peer.Instance
```

Схема:

```text
peersRef
  |
  +-- socketA → Peer
  +-- socketB → Peer
  +-- socketC → Peer
```

`useRef` подходит для WebRTC objects, потому что изменение объекта peer само по себе не должно вызывать React render.

UI state хранится отдельно.

---

## 10. Создание peer

Основная операция концептуально выглядит как:

```ts
createPeer(socketId, initiator)
```

Сначала проверяется наличие локального stream:

```ts
if (!stream) return null;
```

Затем проверяется существующий peer:

```ts
if (peersRef.current.has(socketId)) {
  return peersRef.current.get(socketId)!;
}
```

Это предотвращает создание нескольких peer instances для одного socket.

После этого создаётся:

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

## 11. Что означает `initiator`

`initiator` определяет, какая сторона начинает WebRTC negotiation.

Новый участник получает:

```text
existing-users
```

и делает:

```ts
createPeer(socketId, true)
```

Существующий участник получает:

```text
user-connected
```

и делает:

```ts
createPeer(socketId, false)
```

То есть:

```text
New client
   |
   +--> initiator = true

Existing client
   |
   +--> initiator = false
```

Это позволяет избежать ситуации, когда обе стороны независимо пытаются начать одинаковую negotiation flow.

---

## 12. Локальный `MediaStream`

Источник media получается через browser Media API:

```text
getUserMedia()
      |
      v
 MediaStream
```

Затем stream используется двумя ветками:

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

Первая ветка отвечает за communication.

Вторая используется realtime translation.

Это одна из важнейших архитектурных деталей проекта.

---

## 13. Почему нужен signaling

WebRTC не означает, что два браузера автоматически знают, как соединиться.

Перед установлением media connection им необходимо обменяться negotiation information.

В Merriweather для этого используется Socket.IO.

Основные signaling events:

```text
offer
answer
ice-candidate
```

Socket.IO здесь является signaling transport.

Он не является media transport.

---

## 14. Offer

Initiator создаёт WebRTC signaling data.

`simple-peer` генерирует signal:

```ts
peer.on("signal", ...)
```

Когда signal является offer, frontend отправляет:

```ts
socket.emit("offer", {
  offer: signal.data,
  to: signal.to,
});
```

Backend получает его:

```ts
socket.on("offer", ({ offer, to }) => {
  io.to(to).emit("offer", {
    offer,
    from: socket.id,
  });
});
```

Backend не разбирает SDP.

Он только маршрутизирует signaling payload.

Путь:

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

Browser B получает offer:

```ts
socket.on("offer", ({ offer, from }) => {
  let peer = peersRef.current.get(from);

  if (!peer) {
    peer = createPeer(from, false);
  }

  peer?.signal(offer);
});
```

`simple-peer` обрабатывает offer и создаёт answer.

Frontend отправляет:

```ts
socket.emit("answer", {
  answer: signal.data,
  to: signal.to,
});
```

Backend маршрутизирует:

```ts
io.to(to).emit("answer", {
  answer,
  from: socket.id,
});
```

Browser A принимает answer:

```ts
socket.on("answer", ({ answer, from }) => {
  peersRef.current.get(from)?.signal(answer);
});
```

---

## 16. ICE candidates

Offer/answer недостаточно.

Браузерам необходимо найти возможный network path друг к другу.

Для этого используется ICE.

В `simple-peer`:

```text
trickle: true
```

означает, что ICE candidates могут передаваться постепенно по мере обнаружения.

Frontend отправляет:

```text
ice-candidate
```

Backend пересылает его целевому socket.

Получатель передаёт candidate обратно в peer:

```ts
peersRef.current.get(from)?.signal(candidate);
```

Упрощённо:

```text
Offer
  ↓
Answer
  ↓
ICE candidates
  ↓
WebRTC connection
```

В реальности эти signaling messages могут приходить на разных этапах negotiation.

---

## 17. STUN

Peer configuration содержит:

```ts
iceServers: [
  {
    urls: "stun:stun.l.google.com:19302",
  },
]
```

STUN помогает браузеру определить network information, необходимую для поиска возможного пути между peers.

В текущей реализации:

```text
STUN configured
TURN not configured
```

Это ограничение.

В некоторых NAT/firewall environments прямое соединение может не установиться. TURN обычно используется как relay, когда прямой peer-to-peer path недоступен.

Поэтому в документации нельзя утверждать, что Merriweather имеет полноценную TURN infrastructure, если это не подтверждается кодом.

---

## 18. Где реально передаётся видео

Это один из главных вопросов при демонстрации проекта.

После negotiation:

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

Видео не передаётся постоянно через:

```text
Fastify
Socket.IO
MongoDB
```

Эти системы участвуют в signaling, application events и persistence.

Правильная mental model:

```text
Socket.IO
    =
"Как браузеры договорились о соединении?"

WebRTC
    =
"Теперь передавай media."
```

---

## 19. Получение remote stream

После установления WebRTC connection peer получает remote stream:

```ts
peer.on("stream", (remoteStream) => {
  remoteStreamsRef.current.set(socketId, remoteStream);

  setRemoteVideos(
    new Map(remoteStreamsRef.current)
  );
});
```

Поток:

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

После этого UI может подключить stream к `<video>` element.

---

## 20. Почему `remoteStreamsRef` и `remoteVideos` разделены

`remoteStreamsRef` хранит runtime `MediaStream` objects.

Это mutable browser objects, и их изменение не должно само по себе заставлять React перерисовываться.

Но UI должен узнать, когда stream появился или исчез.

Поэтому создаётся новый `Map`:

```ts
setRemoteVideos(
  new Map(remoteStreamsRef.current)
);
```

Получается разделение:

```text
Ref
  |
  +-- runtime WebRTC objects

State
  |
  +-- data required by UI
```

Это особенно удобно для долгоживущих browser objects вроде WebRTC peers и MediaStreams.

---

## 21. Disconnect handling

Когда пользователь отключается, backend отправляет:

```text
user-disconnected
```

Frontend:

```text
removePeer(socketId)
```

и удаляет participant из UI state.

`removePeer` должен очистить:

1. WebRTC peer;
2. peer reference;
3. remote `MediaStream`;
4. participant UI state.

Концептуально:

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

Это предотвращает накопление stale realtime objects.

---

## 22. Peer error и close

Peer layer также должен обрабатывать:

```text
peer.on("close")
peer.on("error")
```

Оба случая ведут к тому же cleanup path.

Это важно, потому что WebRTC connection может завершиться не только через обычный socket disconnect.

---

## 23. Полный flow первого пользователя

Пусть Ahmed открывает:

```text
/room/123
```

Последовательность:

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

Если других пользователей нет, WebRTC negotiation пока не требуется.

---

## 24. Полный flow второго пользователя

Пусть в комнате уже находится Ahmed.

Ali входит в ту же комнату.

Backend делает:

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

После этого начинается signaling:

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

Параллельно передаются ICE candidates.

После negotiation:

```text
Ali MediaStream
      |
      v
Ahmed remoteStream
```

и наоборот.

---

## 25. Полный signaling flow

Для двух участников:

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

Главное правило:

```text
Socket.IO = signaling/events
WebRTC    = actual media
```

---

## 26. Camera и microphone state

Для состояния controls используются:

```text
camera:update
mic:update
```

Frontend отправляет:

```ts
socket.emit("camera:update", {
  roomId,
  userId,
  enabled,
});
```

и:

```ts
socket.emit("mic:update", {
  roomId,
  userId,
  enabled,
});
```

Backend обновляет runtime participant:

```text
rooms
  |
  +-- participant.cameraEnabled
  +-- participant.microphoneEnabled
```

и сообщает изменение другим clients.

Это application-level synchronization.

Это не замена WebRTC media negotiation.

---

## 27. Language state

Комната также использует:

```text
language:update
```

Backend обновляет runtime state:

```text
users
rooms
```

и сохраняет язык участника в active Session.

Это особенно важно для translation pipeline.

Системе необходимо знать:

```text
Кто говорит на каком языке?
Кому нужен перевод?
```

Текущий основной сценарий:

```text
Russian ↔ English
```

---

## 28. Chat и WebRTC являются разными подсистемами

Text chat использует Socket.IO:

```text
chat:send
    ↓
Fastify
    ↓
MongoDB
    ↓
chat:new
```

Video/audio:

```text
WebRTC
```

Поэтому:

```text
Chat message
    → Socket.IO + MongoDB

Video/audio
    → WebRTC
```

Socket.IO не превращается в единый transport для всех видов media.

---

## 29. Связь видеосвязи с realtime translation

Это особенно важно для понимания проекта.

Оба pipeline получают данные из одного локального `MediaStream`, но выполняют разные задачи:

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

Поэтому правильное объяснение:

> WebRTC отвечает за communication между участниками, а translation pipeline отдельно извлекает аудио из локального stream и отправляет PCM-данные на backend для speech-to-text и translation.

---

## 30. `simple-peer` вместо raw WebRTC API

Нативный WebRTC API является довольно низкоуровневым.

Без abstraction layer пришлось бы напрямую работать с:

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

`simple-peer` предоставляет более высокий уровень абстракции:

```ts
new Peer(...)
peer.signal(...)
peer.on("signal", ...)
peer.on("stream", ...)
peer.destroy()
```

Это значительно уменьшает количество boilerplate, необходимого для управления peer connections и signaling.

---

## 31. Lifecycle `useRoomSession`

`useRoomSession` координирует основные realtime resources.

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

Связь между peer и socket layer проходит через signal callback:

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

При завершении комнаты должны очищаться:

```text
Socket.IO
WebRTC peers
MediaStream
AudioSender
subtitle state
```

---

## 32. React lifecycle и duplicate sessions

Realtime room lifecycle зависит от React lifecycle.

В development mode React может выполнять цикл:

```text
mount
  ↓
cleanup
  ↓
mount
```

Если cleanup немедленно делает:

```ts
socket.disconnect()
```

backend может увидеть:

```text
disconnect
    ↓
room becomes empty
    ↓
finishSession()
```

После повторного mount клиент снова отправляет:

```text
join-room
```

и backend потенциально создаёт новую Session.

Поэтому важно учитывать React lifecycle отдельно от WebRTC protocol.

Это не WebRTC feature, а application lifecycle issue.

---

## 33. Что делает Socket.IO server

Socket.IO server:

- регистрирует пользователей в rooms;
- маршрутизирует `offer`;
- маршрутизирует `answer`;
- маршрутизирует ICE signaling;
- сообщает о подключениях;
- сообщает об отключениях;
- хранит runtime participant state;
- обрабатывает chat events;
- получает audio chunks;
- отправляет subtitle events.

Но он не является media server.

Он не должен рассматриваться как система, через которую проходят обычные video frames:

```text
video frame
audio frame
```

Фактическая media transport выполняется WebRTC.

---

## 34. Основные Socket.IO events

| Event | Direction | Purpose |
|---|---|---|
| `join-room` | client → server | вход в комнату |
| `existing-users` | server → client | существующие участники |
| `user-connected` | server → client | новый участник |
| `offer` | client → server → client | WebRTC offer |
| `answer` | client → server → client | WebRTC answer |
| `ice-candidate` | client → server → client | ICE signaling |
| `user-disconnected` | server → client | удаление участника |
| `camera:update` | client → server → clients | состояние камеры |
| `mic:update` | client → server → clients | состояние микрофона |

---

## 35. Основные frontend-файлы

Ключевые точки реализации:

```text
web/src/features/room-session/hooks/use-media.ts
```

Получение локального `MediaStream`.

```text
web/src/features/room-session/hooks/use-peer.ts
```

Создание и управление `simple-peer`.

```text
web/src/features/room-session/hooks/use-socket.ts
```

Socket.IO connection и signaling.

```text
web/src/features/room-session/hooks/use-room-session.ts
```

Оркестрация room-level логики.

```text
web/src/features/room-session/model/types.ts
```

Типы signaling payloads и room state.

---

## 36. Основные backend-файлы

```text
server/plugins/websocket.js
```

Socket.IO server, rooms, users, signaling и realtime events.

```text
server/services/session.service.js
```

Session lifecycle.

```text
server/services/speech.service.js
```

Speech-to-text pipeline и отдельная audio-processing branch.

```text
server/services/translation.service.js
```

Translation bridge.

Главная WebRTC signaling logic находится в:

```text
server/plugins/websocket.js
```

---

## 37. WebRTC vs Socket.IO

Это различие необходимо понимать очень хорошо.

### Socket.IO

Используется для:

```text
signaling
chat
room events
audio chunks
subtitles
participant state
```

### WebRTC

Используется для:

```text
audio
video
peer-to-peer media
```

Архитектура:

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

Короткая формулировка:

> Socket.IO координирует установление соединения, а WebRTC передаёт фактические audio/video.

---

## 38. Полная техническая цепочка

Вся видеосвязь может быть сведена к:

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

Это основная video communication chain Merriweather.

---

## 39. Что происходит с точки зрения браузера

Без framework terminology:

1. Браузер запрашивает доступ к камере и микрофону.
2. Создаётся `MediaStream`.
3. `simple-peer` получает этот stream.
4. Для каждого remote participant создаётся отдельный peer.
5. Peer negotiation генерирует signaling data.
6. Signaling data отправляется через Socket.IO.
7. Другой browser получает эти данные.
8. Оба peer выполняют WebRTC negotiation.
9. ICE помогает найти возможный network path.
10. После установления соединения remote media приходит через WebRTC.
11. `peer.on("stream")` получает remote `MediaStream`.
12. React получает ссылку на stream и отображает remote video.

---

## 40. Как объяснить видеосвязь на демонстрации

Если спрашивают:

### «Почему вы не передаёте видео через Socket.IO?»

Ответ:

> Socket.IO в проекте используется как signaling и realtime-event transport, а WebRTC предназначен для real-time media communication. Поэтому Socket.IO передаёт небольшие negotiation payloads, а фактический audio/video transport выполняется WebRTC.

### «Зачем нужен signaling server?»

Ответ:

> Два браузера должны обменяться negotiation information, например offer, answer и ICE candidates. В Merriweather Socket.IO выполняет роль signaling layer.

### «Fastify передаёт видео?»

Ответ:

> Нет. Fastify и Socket.IO маршрутизируют signaling messages. Фактический media stream передаётся через WebRTC.

### «Что делает simple-peer?»

Ответ:

> Это abstraction над WebRTC peer connection API. Он упрощает создание peers, signaling и обработку remote streams.

### «Что такое initiator?»

Ответ:

> Это определяет, какая сторона начинает WebRTC negotiation.

### «Что делает trickle: true?»

Ответ:

> Позволяет передавать ICE candidates постепенно по мере их обнаружения.

### «Зачем нужен STUN?»

Ответ:

> Он помогает браузеру получить network information, необходимую для поиска возможного маршрута между peers.

### «Как появляется remote video?»

Ответ:

> После успешной WebRTC negotiation `simple-peer` получает remote `MediaStream` через `peer.on("stream")`. Stream связывается с socket ID, помещается в runtime state и затем используется React UI.

---

## 41. Одноминутное объяснение для интервью

Короткая техническая версия:

> Браузер получает локальный `MediaStream` через `getUserMedia`, содержащий camera и microphone tracks. Этот stream передаётся в `simple-peer`. Для каждого другого участника комнаты приложение создаёт отдельный peer connection. Socket.IO используется как signaling transport: через него между браузерами проходят WebRTC offers, answers и ICE candidates, но сам video/audio stream через Socket.IO не передаётся. После negotiation WebRTC устанавливает peer-to-peer media connection. Remote `MediaStream` приходит через `peer.on("stream")`, сохраняется в runtime state и передаётся в React UI. При отключении участника peer и его remote stream уничтожаются.

Главная идея:

```text
Signaling ≠ Media

Socket.IO
    → помогает peers договориться

WebRTC
    → передаёт actual audio/video
```

---

## 42. Ограничения текущей реализации

Хорошая техническая документация должна фиксировать не только преимущества, но и ограничения.

### Mesh scaling

Каждый participant устанавливает отдельное соединение с каждым другим participant.

Это подходит для небольших комнат, но плохо масштабируется.

### STUN-only configuration

В коде присутствует STUN, но TURN relay не настроен.

Поэтому прямое соединение не может быть гарантировано в любой NAT/firewall environment.

### WebSocket authentication

HTTP routes используют authentication middleware, но Socket.IO `join-room` в текущей архитектуре не демонстрирует отдельную Clerk token validation внутри WebSocket handshake.

Это следует рассматривать как production-hardening area, а не утверждать, что WebSocket authentication полностью решена.

---

## 43. Итоговая архитектура

```text
                     Merriweather Room
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

Ответственности:

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

Центральная идея всей видеосвязи:

```text
Signaling is not media.
```

Socket.IO говорит peers, как установить соединение.

WebRTC передаёт фактические audio/video.

Именно это разделение является ключом к пониманию того, как Merriweather реализует видеосвязь, а не просто к знанию, что в проекте используется `simple-peer`.
