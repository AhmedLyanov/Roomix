# Room и WebRTC: создание комнаты и видеосвязь

## 1. Цель документа

Этот документ описывает фактическую реализацию realtime-комнаты Roomixи установление видеосвязи между участниками.

Здесь важно разделять две задачи:

1. Socket.IO создаёт и синхронизирует realtime-состояние комнаты.
2. WebRTC передаёт media stream непосредственно между браузерами.

Socket.IO не является транспортом для самого видео. Он используется для signaling: передачи `offer`, `answer` и ICE candidates.

---

## 2. Общая схема

```text
                    RoomixRoom

 Browser A                                  Browser B
    │                                           │
    │ getUserMedia()                            │ getUserMedia()
    │                                           │
    ▼                                           ▼
 MediaStream                                  MediaStream
    │                                           │
    ▼                                           ▼
 usePeer()                                     usePeer()
    │                                           │
    └────────────── WebRTC media ───────────────┘
                         │
                         │
              direct peer-to-peer connection
                         │
                         ▼

                Socket.IO / Fastify
                         │
              signaling only:
          offer / answer / ICE candidate
```

Backend дополнительно хранит runtime-состояние участников:

```text
rooms: Map<roomId, Map<socketId, participant>>
users: Map<socketId, userInfo>
```

`rooms` и `users` являются временным состоянием websocket-сервера. Постоянная информация о сессии хранится отдельно в MongoDB.

---

## 3. Получение камеры и микрофона

Первым шагом frontend получает `MediaStream`.

Это делает `useMedia()`.

```ts
navigator.mediaDevices.getUserMedia({
  video: true,
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    sampleRate: 16000,
  },
});
```

В результате браузер возвращает `MediaStream`, содержащий:

- video track;
- audio track.

Stream сохраняется в React state.

```text
getUserMedia()
      ↓
MediaStream
      ↓
useMedia()
      ↓
stream
```

При уничтожении hook все tracks останавливаются:

```ts
localStream?.getTracks().forEach((track) => track.stop());
```

То же самое выполняется через `stopStream()`.

Фактическая реализация `useMedia` использует video и audio одновременно, а для audio задаёт echo cancellation, noise suppression и sample rate 16000. fileciteturn11file6L673-L709

---

## 4. Центральный orchestration hook

Вся комната собирается в `useRoomSession()`.

Он объединяет:

```text
useMedia()
      │
      ├── stream
      │
      ▼
usePeer(stream)
      │
      ├── peersRef
      ├── remoteVideos
      └── createPeer()

useSocket(...)
      │
      ├── Socket.IO
      ├── participants
      ├── signaling
      └── room events

useMediaControls(...)
      │
      ├── camera
      ├── microphone
      └── translation
```

Таким образом UI комнаты не должен самостоятельно управлять WebRTC, Socket.IO и MediaStream.

`useRoomSession()` отдаёт компоненту единый API:

```text
stream
remoteVideos
participants
subtitles
socketId

toggleCamera()
toggleMic()
toggleTranslation()

sendMessage()
updateLanguage()
disconnect()
```

Это видно непосредственно в реализации `useRoomSession`: он создаёт `useMedia`, `usePeer`, `useSocket`, связывает signaling через `setOnSignal(handleSignal)` и объединяет очистку ресурсов в `disconnect()`. fileciteturn10file6L729-L834

---

# 5. Подключение Socket.IO

После появления пользователя и имени `useSocket()` создаёт соединение:

```ts
io(process.env.NEXT_PUBLIC_SIGNALING_URL!, {
  path: "/ws",
  transports: ["websocket"],
  forceNew: true,
});
```

Таким образом используется:

```text
Socket.IO
    ↓
WebSocket transport
    ↓
Fastify server
    ↓
Socket.IO Server
```

Backend поднимает Socket.IO с тем же path:

```text
/ws
```

и хранит runtime state в `rooms` и `users`. fileciteturn13file0L23-L36

---

# 6. Вход в комнату

После события Socket.IO `connect` frontend формирует:

```ts
{
  (roomId, userId, userName, nativeLanguage, userAvatar);
}
```

и отправляет:

```text
join-room
```

Фактический client-side flow:

```text
Socket.IO connect
       ↓
setSocketId()
       ↓
создание AudioSender
       ↓
joinPayload
       ↓
socket.emit("join-room", joinPayload)
```

Это реализовано в `useSocket`. fileciteturn12file0L75-L105

---

# 7. Что делает backend при join-room

Backend получает:

```text
join-room
```

и выполняет несколько независимых операций.

## 7.1 Добавление Socket.IO room

Сначала:

```js
socket.join(roomId);
```

После этого socket становится участником Socket.IO room.

Если runtime room ещё не существует:

```js
if (!rooms.has(roomId)) {
  rooms.set(roomId, new Map());
}
```

Затем создаётся participant object:

```text
socketId
userId
userName
nativeLanguage
cameraEnabled
microphoneEnabled
userAvatar
```

и сохраняется:

```text
rooms.get(roomId).set(socket.id, participant)
```

Одновременно создаётся запись в глобальной `users` Map.

Фактический backend flow подтверждает именно такую структуру. fileciteturn13file0L36-L66

---

# 8. Синхронизация существующих участников

После добавления нового участника backend получает существующих пользователей:

```js
const existingUsers = Array.from(room.values()).filter(
  (user) => user.socketId !== socket.id,
);
```

Новый клиент получает:

```text
existing-users
```

с данными уже находящихся в комнате пользователей.

Затем backend уведомляет старых участников:

```text
user-connected
```

Таким образом используется асимметричная модель.

### Новый пользователь

Получает:

```text
existing-users
```

### Старые пользователи

Получают:

```text
user-connected
```

Это важно для WebRTC, потому что стороны должны понимать, с кем создавать peer connection. fileciteturn13file0L68-L91

---

# 9. Создание Session при входе

После регистрации пользователя в runtime room backend вызывает:

```js
createSession({
  roomId,
  ownerId: userId,
  ownerName: userName,
  ownerAvatar: userAvatar,
  language: nativeLanguage,
});
```

`createSession()` сначала ищет активную Session:

```js
Session.findOne({
  roomId,
  endedAt: { $exists: false },
});
```

Если активная Session существует, она возвращается.

Если её нет, создаётся новая:

```text
Session
├── roomId
├── ownerId
├── ownerName
├── startedAt
└── participants
```

Первый участник становится owner.

Также создаётся:

```text
SESSION_STARTED
```

через `createSessionAction()`. fileciteturn13file6L674-L430

---

# 10. Второй и последующие участники

Если пользователь, который вошёл через `join-room`, не является owner активной Session, backend вызывает:

```text
joinParticipant()
```

Перед сохранением backend проверяет, существует ли уже participant с таким `userId`.

Если нет, участник добавляется:

```text
participants.push({
  userId,
  userName,
  userAvatar,
  language,
  joinedAt
})
```

и создаётся:

```text
PARTICIPANT_JOINED
```

Это позволяет не создавать несколько записей одного пользователя внутри одной Session. fileciteturn13file6L723-L762

---

# 11. Почему Room и Session существуют отдельно

Это два разных уровня состояния.

```text
roomId
 │
 ├── Socket.IO room
 │     └── realtime participants
 │
 └── MongoDB Session
       ├── startedAt
       ├── endedAt
       ├── duration
       └── participant history
```

Socket.IO room существует только пока работает realtime connection.

Session является постоянной историей встречи.

Поэтому:

```text
Room = current realtime state
Session = persistent meeting history
```

---

# 12. Создание WebRTC peer

После получения `existing-users` новый клиент делает:

```ts
createPeer(socketId, true);
```

Для пользователя, который подключился позже, существующий участник получает:

```ts
createPeer(socketId, false);
```

То есть инициатор определяется через boolean:

```text
initiator = true
```

или

```text
initiator = false
```

Это разделяет роли WebRTC negotiation.

Фактический код `useSocket` вызывает `createPeer(socketId, true)` для existing users и `createPeer(socketId, false)` для нового пользователя. fileciteturn12file0L115-L174

---

# 13. Что делает createPeer()

`usePeer()` хранит:

```ts
peersRef: Map<string, Peer.Instance>;
```

и:

```ts
remoteStreamsRef: Map<string, MediaStream>;
```

Когда вызывается:

```ts
createPeer(socketId, initiator);
```

проверяются две вещи.

### Нет MediaStream

```text
stream === null
    ↓
return null
```

### Peer уже существует

```text
peersRef.has(socketId)
    ↓
return existing peer
```

Это защищает от создания нескольких peer connections для одного socket.

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

Фактические параметры `simple-peer` подтверждаются исходником. fileciteturn11file5L598-L639

---

# 14. Что такое initiator

У одного peer:

```text
initiator = true
```

У второго:

```text
initiator = false
```

Initiator начинает WebRTC negotiation.

Условно:

```text
A
initiator = true
    │
    │ offer
    ▼
B
initiator = false
    │
    │ answer
    ▼
A
```

Это не означает, что A всегда является владельцем комнаты.

Это исключительно роль в конкретном WebRTC negotiation.

---

# 15. Signaling

WebRTC не устанавливает соединение исключительно через `new Peer()`.

Peers должны обменяться signaling data.

`simple-peer` генерирует события:

```text
peer.on("signal")
```

Код определяет тип:

```text
offer
answer
ICE candidate
```

и передаёт данные в `onSignalRef`.

После этого `handleSignal()` в `useSocket` превращает их в Socket.IO events:

```text
offer
answer
ice-candidate
```

Схема:

```text
simple-peer
    │
    │ signal
    ▼
usePeer
    │
    │ SignalData
    ▼
useSocket
    │
    ├── offer
    ├── answer
    └── ice-candidate
    │
    ▼
Socket.IO
    │
    ▼
Fastify
    │
    ▼
target socket
```

---

# 16. Offer

Когда initiator генерирует offer:

```text
peer
 ↓
signal event
 ↓
type = offer
 ↓
handleSignal()
 ↓
socket.emit("offer", {
  offer,
  to
})
```

Backend не обрабатывает содержимое offer.

Он просто маршрутизирует его:

```js
io.to(to).emit("offer", {
  offer,
  from: socket.id,
});
```

То есть Socket.IO здесь выступает signaling relay. fileciteturn13file0L122-L132

---

# 17. Получение Offer

На втором клиенте:

```ts
socket.on("offer", ({ offer, from }) => {
  let peer = peersRef.current.get(from);

  if (!peer) {
    peer = createPeer(from, false);
  }

  peer?.signal(offer);
});
```

Если peer ещё не создан, он создаётся.

Затем:

```text
peer.signal(offer)
```

передаёт offer в `simple-peer`.

---

# 18. Answer

После обработки offer второй peer генерирует answer.

Он снова вызывает:

```text
peer.on("signal")
```

Но теперь:

```text
type = answer
```

Frontend отправляет:

```text
answer
```

Backend маршрутизирует его обратно initiator:

```text
Browser B
   │
   │ answer
   ▼
Socket.IO
   │
   ▼
Browser A
   │
   ▼
peer.signal(answer)
```

На клиенте:

```ts
socket.on("answer", ({ answer, from }) => {
  peersRef.current.get(from)?.signal(answer);
});
```

---

# 19. ICE candidates

Для установления peer-to-peer connection WebRTC должен подобрать сетевой маршрут.

`simple-peer` с:

```text
trickle: true
```

позволяет отправлять ICE candidates по мере их появления.

Схема:

```text
Peer A
 │
 ├── ICE candidate
 │
 ▼
Socket.IO
 │
 ▼
Peer B
```

и обратно.

На backend это обычная маршрутизация:

```js
io.to(to).emit("ice-candidate", {
  candidate,
  from: socket.id,
});
```

На клиенте:

```ts
peer.signal(candidate);
```

Фактический client-side handler для offer, answer и ICE candidates находится в `useSocket`. fileciteturn11file0L16-L32

---

# 20. Где реально проходит видео

После завершения signaling:

```text
Socket.IO
    │
    └── больше не передаёт video stream
```

WebRTC peer connection начинает передавать media.

В `simple-peer` stream передаётся при создании:

```ts
stream;
```

После получения remote stream срабатывает:

```ts
peer.on("stream", (remoteStream) => {
  ...
});
```

Remote stream сохраняется:

```text
remoteStreamsRef
```

и затем публикуется через React state:

```text
remoteVideos
```

Фактический код делает именно это: `remoteStreamsRef` связывает socket ID с MediaStream, после чего `setRemoteVideos()` создаёт новое Map-состояние для React. fileciteturn11file5L627-L635

---

# 21. Почему remoteVideos является Map

Используется:

```ts
Map<string, MediaStream>;
```

где:

```text
key   = socketId
value = MediaStream
```

Например:

```text
remoteVideos

socket-A → MediaStream
socket-B → MediaStream
socket-C → MediaStream
```

Это позволяет UI связать:

```text
remote stream
      +
participant metadata
      +
subtitle
```

по одному идентификатору.

---

# 22. Связь stream и participant

В комнате существуют два разных состояния.

### Media state

```text
remoteVideos
```

содержит:

```text
socketId → MediaStream
```

### Participant state

```text
participants
```

содержит:

```text
socketId → {
  userName,
  userAvatar,
  cameraEnabled,
  microphoneEnabled
}
```

UI объединяет их:

```text
socketId
   ├── remoteVideos.get(socketId)
   └── participants.get(socketId)
```

Поэтому MediaStream не должен содержать имя пользователя, avatar или статус микрофона.

---

# 23. Управление камерой

Когда пользователь выключает камеру:

```ts
stream.getVideoTracks().forEach((track) => {
  track.enabled = enabled;
});
```

Это меняет локальный video track.

После этого frontend отправляет:

```text
camera:update
```

с:

```text
{
  roomId,
  userId,
  enabled
}
```

Backend рассылает состояние участникам комнаты.

Получатели обновляют:

```text
participants[socketId].cameraEnabled
```

Важно:

```text
camera:update
```

не создаёт новый WebRTC connection.

Он только синхронизирует UI state. fileciteturn11file6L752-L766

---

# 24. Управление микрофоном

Микрофон работает аналогично.

Frontend:

```ts
stream.getAudioTracks().forEach((track) => {
  track.enabled = enabled;
});
```

Дополнительно:

```ts
audioSenderRef.current?.setMicEnabled(enabled);
```

Это важно для translation pipeline, потому что AudioSender должен знать, разрешено ли ему собирать аудио.

После этого отправляется:

```text
mic:update
```

и другие клиенты обновляют participant state.

fileciteturn11file6L768-L784

---

# 25. Что происходит при отключении участника

Когда socket отключается, остальные клиенты получают:

```text
user-disconnected
```

После этого frontend:

```text
removePeer(socketId)
```

и удаляет participant.

`removePeer()` делает:

```text
peer.destroy()
      ↓
peersRef.delete(socketId)
      ↓
remoteStreamsRef.delete(socketId)
      ↓
setRemoteVideos(...)
```

То есть очищаются и WebRTC connection, и remote stream.

Фактическая обработка `user-disconnected` и очистка peer находятся в `useSocket`/`usePeer`. fileciteturn11file0L34-L44 fileciteturn11file5L145-L150

---

# 26. Backend lifecycle при disconnect

На сервере disconnect приводит к:

```text
leaveParticipant()
```

который записывает:

```text
participant.leftAt = new Date()
```

Если после отключения room становится пустой, вызывается:

```text
finishSession(roomId)
```

Он устанавливает:

```text
endedAt
duration
```

Duration рассчитывается в секундах:

```text
endedAt - startedAt
```

Фактический `session.service.js` содержит именно такой lifecycle. fileciteturn13file6L786-L823

---

# 27. React StrictMode и delayed disconnect

В `useSocket` есть отдельная защита от React StrictMode.

В development React может выполнить:

```text
mount
cleanup
mount
```

Если при первом cleanup сразу вызвать:

```text
socket.disconnect()
```

backend может увидеть:

```text
disconnect
   ↓
finishSession()
```

а затем новый mount:

```text
createSession()
```

В результате можно получить две Session.

Поэтому cleanup откладывает disconnect на 100 ms.

```text
cleanup
   ↓
setTimeout(100ms)
   ↓
socket.disconnect()
```

Если React сразу монтирует компонент повторно:

```text
new mount
   ↓
clearTimeout()
```

и существующая Socket.IO session сохраняется.

Этот механизм явно реализован в `useSocket`. fileciteturn11file0L46-L80

---

# 28. Полный flow подключения

```text
User opens /room/:roomId
        │
        ▼
useMedia()
        │
        ▼
getUserMedia()
        │
        ▼
MediaStream
        │
        ├─────────────────────────┐
        │                         │
        ▼                         ▼
    usePeer()                  useSocket()
        │                         │
        │                         ▼
        │                    Socket.IO connect
        │                         │
        │                         ▼
        │                     join-room
        │                         │
        │                         ▼
        │                    Backend room
        │                         │
        │                         ├── existing-users
        │                         │
        │                         └── user-connected
        │
        ▼
createPeer()
        │
        ▼
simple-peer
        │
        ├── offer
        ├── answer
        └── ICE candidates
                │
                ▼
            Socket.IO
                │
                ▼
          signaling complete
                │
                ▼
        WebRTC connection
                │
                ▼
        remote MediaStream
                │
                ▼
          remoteVideos Map
                │
                ▼
           RoomClient
```

---

# 29. Один-на-один: конкретный пример

Пусть в комнате находятся:

```text
Ahmed
Ali
```

### Ahmed входит первым

```text
Ahmed
 ↓
getUserMedia()
 ↓
Socket.IO connect
 ↓
join-room
 ↓
createSession()
 ↓
Session.create()
 ↓
SESSION_STARTED
```

Peer connection ещё не создаётся, потому что другого пользователя нет.

### Ali входит

Backend:

```text
Ali
 ↓
join-room
 ↓
room contains Ahmed + Ali
```

Ali получает:

```text
existing-users
```

с Ahmed.

Ahmed получает:

```text
user-connected
```

с Ali.

Далее:

```text
Ali
 ↓
createPeer(Ahmed, true)
 ↓
offer
 ↓
Socket.IO
 ↓
Ahmed
 ↓
createPeer(Ali, false)
 ↓
signal(offer)
 ↓
answer
 ↓
Socket.IO
 ↓
Ali
 ↓
signal(answer)
```

Параллельно идут ICE candidates.

После negotiation:

```text
Ahmed MediaStream
       ⇅
   WebRTC peer
       ⇅
Ali MediaStream
```

Видео и аудио идут через WebRTC, а Socket.IO остаётся каналом signaling и других realtime-событий.

---

# 30. Масштабирование на несколько участников

При `N` участниках каждый клиент создаёт peer connection с другими участниками.

Условно:

```text
        Ahmed
       /           /           Ali ----- John
```

Для трёх пользователей:

```text
Ahmed ↔ Ali
Ahmed ↔ John
Ali   ↔ John
```

Для каждого соединения используются отдельные:

```text
Peer.Instance
```

и отдельные:

```text
MediaStream
```

В `peersRef` каждый peer индексируется через socket ID.

Это означает, что текущая архитектура является peer-to-peer mesh-подходом, а не SFU/MCU-архитектурой.

В предоставленном коде действительно используется отдельный `simple-peer` для каждого socket ID и не присутствует SFU-сервер. fileciteturn11file5L598-L639

---

# 31. Что Socket.IO делает, а чего не делает

## Socket.IO делает

```text
join-room
existing-users
user-connected
user-disconnected

offer
answer
ice-candidate

camera:update
mic:update
language:update

chat:send
chat:new

audio-chunk
subtitle
```

Фактический backend websocket plugin содержит signaling events и room events, а frontend использует соответствующие handlers. fileciteturn13file0L36-L149

## Socket.IO не делает

```text
не передаёт MediaStream
не кодирует видео
не является WebRTC media server
не хранит видеопоток
```

Он сообщает peers, как установить соединение.

---

# 32. Что WebRTC делает

WebRTC отвечает за:

```text
audio transport
video transport
peer connection
ICE connectivity
media streams
```

В текущей реализации `simple-peer` создаётся с локальным `MediaStream`, а remote stream приходит через событие `stream`.

---

# 33. Важные технические решения

### Почему signaling вынесен в Socket.IO

Это фактическая архитектура проекта.

Socket.IO уже используется для realtime-коммуникации комнаты, поэтому signaling data можно передавать тем же транспортом.

### Почему video не передаётся через Socket.IO

Потому что текущая архитектура использует WebRTC media transport.

Socket.IO передаёт только небольшие signaling payloads.

### Почему `peersRef` является Map

Потому что каждой WebRTC connection соответствует конкретный socket ID:

```text
socketId → Peer.Instance
```

Это позволяет быстро получить peer при поступлении:

```text
offer
answer
ice-candidate
```

### Почему `remoteVideos` является Map

Потому что remote stream также связан с socket ID:

```text
socketId → MediaStream
```

Это позволяет UI сопоставить поток с participant metadata.

---

# 34. Ограничения текущей реализации

Эта часть важна, потому что документация должна описывать не идеальный проект из фантазии, а реальный код.

## Mesh topology

Каждый участник поддерживает отдельное peer connection с каждым другим участником.

При увеличении количества пользователей количество соединений растёт примерно квадратично:

```text
N users
→ N(N - 1) / 2 connections
```

Для небольших комнат это приемлемо, но для больших конференций обычно требуется SFU.

## STUN only

В `simple-peer` указан:

```text
stun:stun.l.google.com:19302
```

В предоставленном коде не видно TURN-сервера.

Следовательно, при сложных NAT/firewall-сценариях соединение может не установиться.

## WebSocket authentication

В текущем `join-room` frontend передаёт `userId`, `userName` и другие данные через payload. В предоставленной websocket-реализации не видно проверки Clerk token непосредственно перед `join-room`.

HTTP routes при этом имеют authentication middleware там, где он предусмотрен.

Поэтому realtime authorization является отдельной зоной, которую стоит усиливать перед production deployment.

## Session race condition

`createSession()` сначала делает:

```text
findOne(active session)
```

а затем:

```text
Session.create()
```

Без транзакционной/уникальной защиты два параллельных подключения потенциально могут пройти проверку одновременно.

Frontend дополнительно защищается от React StrictMode delayed disconnect, но серверная операция сама по себе не является атомарной.

---

# 35. Ключевые файлы

## Frontend

```text
use-media.ts
```

Получение и остановка MediaStream.

```text
use-peer.ts
```

Создание, хранение и уничтожение WebRTC peers.

```text
use-socket.ts
```

Socket.IO connection, room events и signaling.

```text
use-room-session.ts
```

Главный orchestration layer.

```text
use-media-controls.ts
```

Camera/microphone state и translation toggle.

## Backend

```text
websocket.js
```

Socket.IO server, room runtime state, signaling и realtime events.

```text
session.service.js
```

Session lifecycle.

```text
session-action.service.js
```

Session history.

---

# 36. Главный mental model

Если нужно объяснить всю систему одной схемой:

```text
                    ROOM
                     │
             Socket.IO connection
                     │
              ┌──────┴──────┐
              │             │
         Room state      Signaling
              │             │
              │       offer / answer
              │       ICE candidates
              │             │
              ▼             ▼
        Participants     WebRTC
              │             │
              │             ▼
              │        MediaStream
              │
              ▼
         RoomClient UI


              SESSION
                 │
                 ▼
              MongoDB
                 │
        ┌────────┴────────┐
        │                 │
     Session        SessionAction
```

Главное, что должен понимать разработчик:

```text
Room ≠ Session
Socket.IO ≠ WebRTC media
signaling ≠ video transport
participant state ≠ MediaStream
runtime room state ≠ persistent session history
```

Именно эти пять различий объясняют большую часть архитектуры Roomix.
