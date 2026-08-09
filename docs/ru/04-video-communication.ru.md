# Merriweather — WebRTC и видеосвязь

## 1. Назначение

Видеосвязь — базовая realtime-функция Merriweather. Пользователи входят в одну комнату, получают доступ к камере и микрофону, устанавливают peer-to-peer соединения и видят медиапотоки друг друга.

В проекте WebRTC отвечает именно за передачу аудио/видео между браузерами. Socket.IO при этом не передаёт сам видеопоток. Он используется как signaling-канал: через него участники обмениваются данными, необходимыми для установления WebRTC-соединения.

Упрощённо архитектура выглядит так:

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

После установления WebRTC:

Browser A <====================> Browser B
             MediaStream
           audio + video
```

Это фундаментальное различие важно понимать: Socket.IO помогает двум браузерам договориться о соединении, а WebRTC затем передаёт media напрямую между peer'ами.

---

## 2. Основные технологии

В видеосвязи используются:

- Browser `MediaStream` — локальный микрофон и камера.
- `simple-peer` — frontend-обёртка над WebRTC API.
- Socket.IO client — signaling на frontend.
- Socket.IO server — signaling на backend.
- `STUN` server — помогает определить сетевой адрес peer.
- React hooks — управление lifecycle комнаты, peer connections и состоянием remote streams.

В исходной реализации `simple-peer` создаётся с:

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

То есть каждый peer получает локальный `MediaStream`, а ICE negotiation выполняется с включённым trickle ICE.

---

## 3. Главные frontend-модули

WebRTC flow распределён между несколькими hooks.

### `useMedia`

Получает локальный `MediaStream` от браузера.

Он является источником:

```text
camera track
microphone track
        |
        v
    MediaStream
```

Этот же stream используется дальше:

- для локального видео;
- для `simple-peer`;
- отдельно для realtime translation через `AudioSender`.

Таким образом, видеосвязь и realtime translation используют один источник микрофона, но имеют разные pipeline обработки.

### `usePeer`

Отвечает непосредственно за WebRTC peer connections.

Он хранит:

```ts
peersRef
remoteStreamsRef
remoteVideos
```

`peersRef` связывает `socketId` участника с его `simple-peer` instance.

`remoteStreamsRef` связывает `socketId` с полученным от него `MediaStream`.

`remoteVideos` является React state, чтобы UI мог перерисоваться после появления нового remote stream.

### `useSocket`

Отвечает за Socket.IO connection и signaling.

Он:

- подключается к Socket.IO server;
- отправляет `join-room`;
- получает список участников;
- реагирует на `user-connected`;
- пересылает `offer`;
- пересылает `answer`;
- пересылает `ice-candidate`;
- удаляет peer при `user-disconnected`.

### `useRoomSession`

Объединяет эти части в один room-level API:

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

Сам room UI не должен знать детали установления WebRTC-соединения. Он получает уже готовые данные:

```ts
stream
remoteVideos
participants
disconnect
```

---

## 4. Вход пользователя в комнату

Пользователь попадает на:

```text
/room/:roomId
```

`useRoomSession` запускает `useMedia`, после чего появляется локальный:

```ts
MediaStream
```

Этот stream передаётся в `usePeer`.

Затем `useSocket` создаёт Socket.IO connection:

```ts
io(process.env.NEXT_PUBLIC_SIGNALING_URL!, {
  path: "/ws",
  transports: ["websocket"],
  forceNew: true,
});
```

После подключения frontend отправляет:

```ts
socket.emit("join-room", {
  roomId,
  userId,
  userName,
  nativeLanguage,
  userAvatar,
});
```

На backend это событие также связано с lifecycle `Session`.

Backend:

1. добавляет socket в room;
2. сохраняет runtime-информацию об участнике;
3. сообщает новому участнику о существующих пользователях;
4. сообщает существующим пользователям о новом участнике;
5. создаёт или восстанавливает активную Session.

---

## 5. Runtime state backend

Socket.IO server хранит два runtime `Map`.

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

Второй Map связывает socket с пользователем:

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

`rooms` используется для работы с участниками конкретной комнаты.

`users` позволяет быстро определить, кто связан с конкретным socket.

---

## 6. Как новый пользователь узнаёт о существующих

Когда пользователь входит в комнату, backend получает текущий `room`.

Из него формируется список:

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

Если участники уже существуют:

```ts
socket.emit("existing-users", {
  users: existingUsers,
});
```

Новый пользователь получает список peer'ов, с которыми ему нужно установить соединения.

---

## 7. Как существующие пользователи узнают о новом

Одновременно backend сообщает остальным:

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

Таким образом возникают два разных сценария:

```text
Новый пользователь
        |
        v
existing-users
        |
        v
создаёт peer'ы к существующим
```

и:

```text
Существующие пользователи
        |
        v
user-connected
        |
        v
создают peer к новому
```

Это позволяет обеим сторонам узнать о необходимости установить WebRTC connection.

---

## 8. Что такое peer connection

Для каждого другого участника создаётся отдельный `simple-peer`.

Если в комнате три пользователя:

```text
Ahmed
Ali
John
```

то у Ahmed будут:

```text
Ahmed
  |
  +-- Peer(Ali)
  |
  +-- Peer(John)
```

У Ali:

```text
Ali
  |
  +-- Peer(Ahmed)
  |
  +-- Peer(John)
```

И так далее.

Это означает, что текущая архитектура является mesh-like peer-to-peer схемой.

Количество peer connections растёт вместе с количеством участников.

---

## 9. `peersRef`

В `usePeer`:

```ts
const peersRef = useRef<Map<string, Peer.Instance>>(new Map());
```

Ключ:

```text
socketId
```

Значение:

```text
simple-peer instance
```

Например:

```text
peersRef
  |
  +-- socketA -> Peer instance
  +-- socketB -> Peer instance
  +-- socketC -> Peer instance
```

`useRef` выбран потому, что peer instances не должны вызывать React render при каждом изменении.

React state используется отдельно для данных, которые должны отображаться в UI.

---

## 10. Создание peer

Основная функция:

```ts
createPeer(socketId, initiator)
```

Сначала проверяется локальный stream:

```ts
if (!stream) return null;
```

Затем проверяется, существует ли уже peer:

```ts
if (peersRef.current.has(socketId)) {
  return peersRef.current.get(socketId)!;
}
```

Это предотвращает создание двух peer connections для одного socket.

После этого создаётся:

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

## 11. Что означает `initiator`

Параметр:

```ts
initiator
```

определяет, какая сторона начинает negotiation.

Например, новый пользователь получил:

```text
existing-users
```

Он вызывает:

```ts
createPeer(socketId, true)
```

То есть для существующего пользователя он становится initiator.

Когда существующий пользователь получает:

```text
user-connected
```

он вызывает:

```ts
createPeer(socketId, false)
```

Таким образом две стороны не должны одновременно хаотично создавать одну и ту же negotiation flow.

---

## 12. `stream` внутри Peer

При создании peer передаётся:

```ts
stream
```

Это означает, что локальные audio/video tracks подключаются к WebRTC peer connection.

Схематично:

```text
getUserMedia()
      |
      v
 MediaStream
      |
      +--------------------+
      |                    |
      v                    v
 simple-peer         AudioSender
      |                    |
      v                    v
 WebRTC media        audio-chunk
```

Это две независимые ветки.

WebRTC передаёт обычный media stream участнику.

`AudioSender` отдельно извлекает PCM для realtime speech recognition.

---

## 13. Signaling: зачем он нужен

WebRTC не означает, что браузеры автоматически знают, как соединиться.

Им необходимо обменяться negotiation information.

В проекте для этого используется Socket.IO.

Основные signaling events:

```text
offer
answer
ice-candidate
```

Socket.IO здесь выступает как signaling transport.

Он не является media transport.

---

## 14. Offer

Когда initiator создаёт peer, `simple-peer` генерирует signaling data.

Frontend получает это через:

```ts
peer.on("signal", (data) => {
  ...
});
```

Если:

```ts
signalData.type === "offer"
```

создаётся:

```ts
{
  type: "offer",
  data,
  to: socketId
}
```

Затем `handleSignal` отправляет:

```ts
socket.emit("offer", {
  offer: signal.data,
  to: signal.to,
});
```

Backend получает:

```ts
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
   |
   | offer
   v
Socket.IO
   |
   | offer
   v
Browser B
```

Backend здесь не анализирует offer. Он просто маршрутизирует его нужному socket.

---

## 15. Answer

Browser B получает:

```ts
socket.on("offer", ({ offer, from }) => {
  let peer = peersRef.current.get(from);

  if (!peer) {
    peer = createPeer(from, false);
  }

  peer?.signal(offer);
});
```

`simple-peer` обрабатывает offer.

После этого peer генерирует `answer`.

Frontend определяет:

```ts
signalData.type === "answer"
```

и отправляет:

```ts
socket.emit("answer", {
  answer: signal.data,
  to: signal.to,
});
```

Backend:

```ts
socket.on("answer", ({ answer, to }) => {
  io.to(to).emit("answer", {
    answer,
    from: socket.id,
  });
});
```

Browser A получает:

```ts
socket.on("answer", ({ answer, from }) => {
  peersRef.current.get(from)?.signal(answer);
});
```

Теперь обе стороны обменялись основной negotiation information.

---

## 16. ICE candidates

Одного offer/answer недостаточно.

Браузерам также необходимо определить возможные сетевые пути между собой.

Для этого используется ICE.

В `simple-peer`:

```ts
trickle: true
```

означает, что ICE candidates могут отправляться постепенно по мере их обнаружения, а не ждать формирования одного большого signaling message.

Когда `signal` содержит не `offer` и не `answer`, код трактует его как:

```ts
ice-candidate
```

и отправляет:

```ts
socket.emit("ice-candidate", {
  candidate: signal.data,
  to: signal.to,
});
```

Backend просто пересылает:

```ts
io.to(to).emit("ice-candidate", {
  candidate,
  from: socket.id,
});
```

Получатель:

```ts
socket.on("ice-candidate", ({ candidate, from }) => {
  peersRef.current.get(from)?.signal(candidate);
});
```

Итак:

```text
Offer
  ↓
Answer
  ↓
ICE candidates
  ↓
WebRTC connection
```

На практике signaling messages могут приходить в процессе negotiation, поэтому правильнее воспринимать это как обмен negotiation data, а не как строго последовательный HTTP-подобный запрос.

---

## 17. STUN

Peer создаётся с:

```ts
iceServers: [
  {
    urls: "stun:stun.l.google.com:19302",
  },
]
```

STUN помогает браузеру определить информацию о своём сетевом расположении и найти потенциальный путь до другого peer.

В проекте используется STUN, но отдельный TURN server в показанной конфигурации не указан.

Это важное ограничение.

В сложных сетях, NAT и firewall условиях одного STUN может быть недостаточно. TURN обычно используется как relay fallback, когда прямое peer-to-peer соединение невозможно.

Но документация проекта должна отражать фактическую конфигурацию, а не приписывать Merriweather TURN infrastructure, которой в исходном коде нет.

---

## 18. Получение remote stream

После успешного установления media connection:

```ts
peer.on("stream", (remoteStream) => {
  remoteStreamsRef.current.set(socketId, remoteStream);

  setRemoteVideos(
    new Map(remoteStreamsRef.current)
  );
});
```

Получается:

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

Это тот момент, когда приложение фактически получает аудио/видео другого участника.

---

## 19. Почему `remoteStreamsRef` и `remoteVideos` разделены

`remoteStreamsRef` хранит актуальные `MediaStream` без необходимости вызывать React render при каждой внутренней операции.

Но UI должен узнать, что появился новый stream.

Поэтому после изменения ref создаётся новый Map:

```ts
setRemoteVideos(
  new Map(remoteStreamsRef.current)
);
```

React получает новый объект состояния и выполняет render.

Получается разделение:

```text
Ref
  |
  +-- runtime WebRTC objects

State
  |
  +-- data required by UI
```

---

## 20. Обработка disconnect

Когда участник отключается, backend отправляет:

```ts
socket.to(roomId).emit("user-disconnected", {
  socketId: socket.id,
});
```

Frontend получает:

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

`removePeer`:

```ts
peersRef.current.get(socketId)?.destroy();
peersRef.current.delete(socketId);

remoteStreamsRef.current.delete(socketId);

setRemoteVideos(
  new Map(remoteStreamsRef.current)
);
```

То есть удаляются сразу:

1. WebRTC peer;
2. runtime reference;
3. remote MediaStream;
4. participant UI state.

---

## 21. Ошибка peer

В `usePeer` также существуют:

```ts
peer.on("close", () => removePeer(socketId));

peer.on("error", () => removePeer(socketId));
```

Если peer закрывается или возникает ошибка, он удаляется тем же cleanup path.

Это важно, потому что иначе `peersRef` мог бы содержать уже неработающий peer.

---

## 22. Полный flow: один пользователь входит

Предположим:

```text
Ahmed
```

открывает:

```text
/room/123
```

Flow:

```text
1. Browser opens room
        ↓
2. useMedia()
        ↓
3. get MediaStream
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

Если пользователей нет, WebRTC negotiation пока не требуется.

---

## 23. Полный flow: второй пользователь входит

Теперь:

```text
Ahmed
Ali
```

Ali входит в ту же комнату.

Backend:

```text
join-room(Ali)
      |
      +--> existing-users -> Ali
      |
      +--> user-connected -> Ahmed
```

Frontend:

```text
Ali:
existing-users
    ↓
createPeer(Ahmed, true)

Ahmed:
user-connected
    ↓
createPeer(Ali, false)
```

После этого:

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

Происходит offer/answer/ICE exchange.

После установления соединения:

```text
Ali MediaStream
      |
      v
Ahmed remoteStream
```

и наоборот.

---

## 24. Полный flow signaling

Для двух пользователей:

```text
             Socket.IO
          signaling server
           /           \
          /             \
     Browser A       Browser B
         |                |
      Peer A           Peer B
         |                |
         +--- WebRTC ----+
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

Главное: после negotiation media не должна проходить через Fastify/Socket.IO как обычный chat message.

---

## 25. Почему Socket.IO, а не REST

REST хорошо подходит для операций типа:

```text
GET session
GET session actions
POST file
```

Но WebRTC signaling требует быстрый двунаправленный канал:

```text
offer
answer
ICE candidate
user-connected
user-disconnected
```

Поэтому Socket.IO подходит значительно лучше.

Кроме signaling, тот же канал используется проектом для:

- room events;
- chat;
- audio chunks для speech-to-text;
- subtitles;
- camera state;
- microphone state.

---

## 26. Camera и microphone state

В комнате есть отдельные события:

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

или:

```ts
socket.emit("mic:update", {
  roomId,
  userId,
  enabled,
});
```

Backend обновляет participant runtime state:

```text
rooms
  |
  +-- participant.cameraEnabled
  +-- participant.microphoneEnabled
```

и сообщает другим:

```text
camera:update
mic:update
```

Эти события не заменяют WebRTC media negotiation. Они синхронизируют состояние UI и participant controls.

---

## 27. Где здесь realtime translation

Важный архитектурный момент: video call и translation связаны через один `MediaStream`, но это не одна и та же система.

```text
                    MediaStream
                         |
             +-----------+-----------+
             |                       |
             v                       v
        simple-peer             AudioSender
             |                       |
             v                       v
        WebRTC media            audio-chunk
                                     |
                                     v
                                SpeechService
                                     |
                                     v
                                  subtitle
```

Поэтому можно отдельно объяснить:

> WebRTC отвечает за коммуникацию между участниками, а translation pipeline извлекает аудио из локального stream и отправляет PCM на backend для speech-to-text и translation.

Это хорошее архитектурное разделение ответственности.

---

## 28. Почему mesh architecture имеет ограничение

В текущей архитектуре каждый участник устанавливает отдельный peer connection с другими участниками.

Если:

```text
N = количество участников
```

то число peer connections примерно растёт как:

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

Поэтому mesh хорошо подходит для небольших комнат, но плохо масштабируется на очень большие конференции.

Для масштабирования обычно применяют SFU architecture.

Но Merriweather не использует SFU в текущей реализации, поэтому не следует говорить, что проект построен на SFU.

---

## 29. Почему `simple-peer`

Нативный WebRTC API довольно низкоуровневый.

Без библиотеки разработчику пришлось бы напрямую работать с:

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

`simple-peer` предоставляет более удобную abstraction layer.

В проекте благодаря этому основной код работает с:

```ts
new Peer(...)
peer.signal(...)
peer.on("signal", ...)
peer.on("stream", ...)
peer.destroy()
```

Это значительно уменьшает объём signaling/peer-management boilerplate.

---

## 30. Lifecycle `useRoomSession`

`useRoomSession` объединяет все ресурсы комнаты.

При старте:

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

Затем `setOnSignal(handleSignal)` связывает два слоя:

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

При отключении:

```ts
disconnectSocket();
destroyAllPeers();
stopStream();
clearSubtitles();
```

То есть закрываются все основные ресурсы комнаты.

---

## 31. Cleanup

Cleanup должен удалить:

```text
Socket.IO connection
WebRTC peers
MediaStream
AudioSender
subtitle state
```

Для peer connections:

```ts
destroyAllPeers()
```

Для локального media:

```ts
stopStream()
```

Для Socket.IO:

```ts
disconnectSocket()
```

Для translation subtitle state:

```ts
clearSubtitles()
```

Это особенно важно в React development environment, где Strict Mode может выполнять mount → cleanup → mount.

В проекте lifecycle socket дополнительно учитывает этот сценарий, чтобы development remount не приводил к преждевременному disconnect и повторному созданию Session.

---

## 32. React Strict Mode и duplicate Session

Это важная практическая проблема, с которой проект столкнулся.

Если React development lifecycle делает:

```text
mount
  ↓
cleanup
  ↓
mount
```

а cleanup мгновенно вызывает:

```text
socket.disconnect()
```

backend видит:

```text
disconnect
    ↓
room becomes empty
    ↓
finishSession()
```

Следующий mount снова отправляет:

```text
join-room
```

и backend может создать новую Session.

В результате история может содержать две Session вместо одной.

В текущей версии `useSocket` cleanup использует небольшой delayed disconnect, чтобы дать React Strict Mode выполнить development remount без немедленного завершения realtime session.

Это не WebRTC protocol feature. Это защита lifecycle приложения от особенностей React development mode.

---

## 33. Что Socket.IO сервер делает, а чего не делает

### Делает

Socket.IO server:

- регистрирует пользователей в rooms;
- маршрутизирует `offer`;
- маршрутизирует `answer`;
- маршрутизирует ICE signaling;
- сообщает о подключении;
- сообщает об отключении;
- хранит runtime participant state;
- передаёт chat events;
- принимает audio chunks;
- отправляет subtitles.

### Не делает

В текущей архитектуре Socket.IO server не является хранилищем видеопотока.

Он не должен получать:

```text
video frame
audio frame
```

как обычные Socket.IO messages для дальнейшей пересылки между всеми пользователями.

Для media используется WebRTC.

---

## 34. Главные Socket.IO события WebRTC

| Event | Direction | Назначение |
|---|---|---|
| `join-room` | client → server | вход пользователя в комнату |
| `existing-users` | server → client | список уже находящихся участников |
| `user-connected` | server → client | новый участник появился |
| `offer` | client → server → client | передача WebRTC offer |
| `answer` | client → server → client | передача WebRTC answer |
| `ice-candidate` | client → server → client | передача ICE signaling data |
| `user-disconnected` | server → client | удаление участника |
| `camera:update` | client → server → clients | состояние камеры |
| `mic:update` | client → server → clients | состояние микрофона |

---

## 35. Главные frontend files

Основные точки реализации:

```text
web/src/features/room-session/hooks/use-media.ts
```

Получение локального MediaStream.

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

Композиция всей room logic.

```text
web/src/features/room-session/model/types.ts
```

Типы signaling payloads и room state.

---

## 36. Главные backend files

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

Speech-to-text pipeline, который использует отдельную ветку audio processing.

```text
server/services/translation.service.js
```

Translation bridge.

WebRTC signaling непосредственно реализован в:

```text
server/plugins/websocket.js
```

---

## 37. WebRTC vs Socket.IO

Очень важно уметь объяснить разницу.

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

Схема:

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

---

## 38. Полный технический flow

Можно свести всю реализацию к следующей последовательности:

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
simple-peer signal event
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

Это и есть основная цепочка видеосвязи Merriweather.

---

## 39. Что происходит с точки зрения браузера

Если объяснять без framework terminology:

1. Браузер получает доступ к камере и микрофону.
2. Создаётся `MediaStream`.
3. `simple-peer` получает этот stream.
4. Для каждого remote participant создаётся peer.
5. Peer negotiation создаёт signaling data.
6. Signaling data отправляется через Socket.IO.
7. Другой браузер принимает signaling data.
8. Оба peer выполняют WebRTC negotiation.
9. ICE помогает найти сетевой путь.
10. После установления connection remote media приходит через WebRTC.
11. `peer.on("stream")` получает remote `MediaStream`.
12. React сохраняет stream и отображает видео.

---

## 40. Что разработчик должен уметь объяснить на демонстрации

После изучения этого документа необходимо уметь ответить на следующие вопросы.

### Почему не отправлять видео через Socket.IO?

Потому что Socket.IO используется как signaling/realtime event transport, а WebRTC специально предназначен для real-time media communication.

### Зачем нужен signaling server?

Чтобы два браузера могли обменяться negotiation information:

```text
offer
answer
ICE candidates
```

### Передаёт ли Fastify видео?

Нет. В текущей архитектуре Fastify/Socket.IO маршрутизирует signaling messages. Media передаётся через WebRTC.

### Что делает `simple-peer`?

Упрощает работу с WebRTC peer connection и signaling data.

### Что такое `initiator`?

Определяет сторону, которая начинает negotiation.

### Что делает `trickle: true`?

Позволяет передавать ICE signaling data по мере появления кандидатов.

### Зачем нужен STUN?

Для получения информации, необходимой для поиска возможного сетевого пути между peers.

### Где хранится remote video?

Сначала в `remoteStreamsRef`, затем через `remoteVideos` оно становится доступным React UI.

### Что происходит при disconnect?

Peer уничтожается, remote stream удаляется, participant state очищается, а backend удаляет socket из room.

### Как связана видеосвязь с переводом?

Они используют один исходный `MediaStream`, но имеют разные pipeline:

```text
MediaStream
   |
   +--> WebRTC --> remote audio/video
   |
   +--> AudioSender --> PCM --> speech-to-text --> translation
```

---

## 41. Краткая схема для собеседования

Если нужно объяснить всю видеосвязь за минуту:

> Пользователь получает MediaStream через браузерный getUserMedia. Этот stream передаётся в simple-peer. Для каждого участника комнаты создаётся отдельный peer connection. Socket.IO используется как signaling server: он передаёт offer, answer и ICE candidates между браузерами, но не передаёт сам video/audio stream. После negotiation WebRTC устанавливает peer-to-peer media connection. Полученный remote MediaStream приходит через `peer.on("stream")`, сохраняется в runtime map и передаётся в React UI. При отключении peer уничтожается, stream удаляется, а backend обновляет состояние комнаты.

Это и есть суть реализации без лишнего магического заклинания «мы просто подключили WebRTC».

---

## 42. Архитектурные ограничения текущей реализации

Документация должна фиксировать не только сильные стороны, но и ограничения.

### Mesh scaling

Каждый пользователь соединяется с другими напрямую.

Это хорошо для небольших комнат, но плохо масштабируется при большом количестве участников.

### STUN-only configuration

В показанном `simple-peer` configuration присутствует STUN server, но TURN relay не указан.

Следовательно, нельзя гарантировать успешное прямое соединение во всех сетевых условиях.

### Signaling authentication

В предоставленной реализации WebSocket connection и `join-room` flow не показывают отдельной проверки Clerk token внутри Socket.IO handshake.

HTTP API использует authentication middleware, но signaling layer следует рассматривать отдельно.

Это потенциальная область для production hardening.

---

## 43. Итоговая архитектура

Merriweather разделяет realtime communication на несколько уровней:

```text
                    Merriweather Room
                           |
              +------------+------------+
              |                         |
              v                         v
        Socket.IO                  WebRTC
       signaling/events              media
              |                         |
       +------+------+             +----+----+
       |      |      |             |         |
     rooms  chat  subtitles      audio      video
              |
              v
       speech / translation
```

Именно это разделение делает архитектуру понятной:

- Socket.IO координирует;
- WebRTC передаёт media;
- React управляет UI;
- backend управляет room/session state;
- отдельные services занимаются speech и translation.

Главная идея:

```text
Signaling is not media.

Socket.IO tells peers how to connect.
WebRTC carries the actual audio/video.
```

Это ключевая концепция, которую необходимо понимать, чтобы действительно разбираться в реализации видеосвязи проекта, а не просто знать название библиотеки `simple-peer`.
