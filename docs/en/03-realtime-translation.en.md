# Merriweather — Real-Time Speech Translation

## 1. Purpose

Real-time speech translation is one of Merriweather's main technical capabilities.

The system allows participants in the same room to communicate using two supported languages:

```text
Russian ↔ English
```

The key idea is not to translate the entire WebRTC audio stream. Translation uses a separate audio-processing pipeline:

```text
Микрофон
   ↓
MediaStream
   ↓
AudioSender
   ↓
PCM audio chunks
   ↓
Socket.IO: "audio-chunk"
   ↓
Fastify / Socket.IO
   ↓
SpeechService
   ↓
Python /speech-to-text
   ↓
recognized text
   ↓
listener language detection
   ↓
group listeners by language
   ↓
TranslationService
   ↓
Python /translate
   ↓
translatedText
   ↓
Socket.IO: "subtitle"
   ↓
React
   ↓
subtitle UI
```

This is important: WebRTC handles normal audio and video delivery between participants, while the translation pipeline separately receives audio data from the local `MediaStream` and processes it for subtitles.

---

# 2. Full Architecture

The translation system consists of several independent parts:

```text
Frontend
│
├── useMedia
│     └── получает MediaStream
│
├── useSocket
│     ├── создаёт Socket.IO connection
│     ├── запускает AudioSender
│     ├── отправляет audio-chunk
│     └── принимает subtitle
│
└── AudioSender
      ├── AudioContext
      ├── MediaStreamSource
      ├── ScriptProcessor
      ├── Float32 → Int16
      └── Socket.IO
              │
              ▼
Backend
│
├── websocket.service.js
│     ├── получает audio-chunk
│     ├── определяет speaker
│     ├── вызывает speechService
│     ├── группирует listeners
│     ├── вызывает translationService
│     └── отправляет subtitle
│
├── speech.service.js
│     └── bridge → Python /speech-to-text
│
└── translation.service.js
      └── bridge → Python /translate
              │
              ▼
Python service
│
├── faster-whisper
│     └── speech-to-text
│
└── MarianMT / Helsinki-NLP
      └── Russian ↔ English
```

---

# 3. Where the Audio Comes From

The `useMedia` component/hook obtains a browser `MediaStream`.

This stream contains both an audio track and a video track.

Упрощённо:

```text
navigator.mediaDevices.getUserMedia(...)
                ↓
             MediaStream
                │
        ┌───────┴────────┐
        ↓                ↓
     WebRTC          AudioSender
        │                │
   video/audio        translation
```

The system does not create a separate microphone stream specifically for translation.

It reuses the existing `MediaStream`.

This allows the application to:

1. send audio through WebRTC;
2. extract audio data for speech-to-text.

---

# 4. AudioSender

`AudioSender` is the frontend component responsible for preparing audio for speech recognition.

It receives:

```typescript
start(stream: MediaStream)
```

and stores the provided stream.

Its main internal objects are:

```text
AudioContext
MediaStreamAudioSourceNode
ScriptProcessorNode
MediaStream
Socket
```

The current implementation uses `ScriptProcessorNode` for audio capture.

This should not be confused with `AudioWorklet`: the project's current capture path is implemented with `ScriptProcessorNode`. An `AudioWorklet` migration was also considered in the project materials, but that is a separate architectural change and should not be treated as part of the current flow.

---

# 5. AudioContext

`AudioSender` creates:

```typescript
new AudioContext({
  sampleRate: 16000,
});
```

The target sample rate is:

```text
16 kHz
```

This matches the format expected by the speech-to-text pipeline.

The source is then created:

```typescript
audioContext.createMediaStreamSource(stream)
```

It connects the audio track from the existing `MediaStream` to the Web Audio API.

The result is:

```text
MediaStream
    ↓
MediaStreamAudioSourceNode
    ↓
AudioContext
```

---

# 6. ScriptProcessor

Audio data is extracted using:

```typescript
audioContext.createScriptProcessor(
  4096,
  1,
  1
)
```

Here:

```text
4096
    = buffer size

1
    = one input channel

1
    = one output channel
```

When the browser provides the next audio block, it invokes:

```typescript
onaudioprocess
```

The data is read from:

```typescript
event.inputBuffer.getChannelData(0)
```

The result is:

```text
Float32Array
```

At this stage, the audio is represented as an array of floating-point audio samples.

---

# 7. Microphone State Check

Before sending data, AudioSender checks:

```text
isActive
isMicEnabled
```

If capture is stopped:

```text
isActive === false
```

the audio is not sent.

If the microphone is disabled:

```text
isMicEnabled === false
```

аудио также не отправляется.

This keeps the translation pipeline synchronized with the microphone state.

---

# 8. Silence Filtering

Before sending the block, the system checks its amplitude.

A threshold is used, for example:

```text
0.01
```

If the block's maximum amplitude is below the threshold, it is treated as silence and is not sent.

Conceptually:

```text
audio chunk
    ↓
max amplitude
    ↓
< threshold?
   ├── yes → discard
   └── no  → process
```

This reduces the amount of useless audio data that would otherwise be sent to the backend and speech recognition service.

---

# 9. Float32 → Int16 PCM

The Web Audio API provides samples as:

```text
Float32Array
```

The backend/Python speech endpoint expects:

```text
PCM 16-bit
```

Therefore, the data is converted:

```text
Float32
   ↓
clamp [-1, 1]
   ↓
Int16
```

The conversion logic is:

```text
negative sample
    → sample × 0x8000

positive sample
    → sample × 0x7FFF
```

The result is:

```text
Int16Array
```

Its underlying buffer is then sent:

```typescript
pcmData.buffer
```

Therefore, Socket.IO carries binary PCM data rather than text.

---

# 10. Audio Chunk

Each prepared block is sent through:

```text
audio-chunk
```

Direction:

```text
Client
   ↓
Socket.IO
   ↓
Backend
```

The payload contains binary PCM data.

The current `AudioSender` implementation sends:

```typescript
socket.emit("audio-chunk", pcmData.buffer)
```

This is an important architectural distinction:

```text
audio-chunk
    ≠
audio file

audio-chunk
    =
part of a PCM audio buffer
```

---

# 11. Why Server-Side Buffering Is Needed

If every small audio chunk were sent directly to speech recognition, the system would generate a huge number of individual requests.

Therefore, the backend does not immediately send every chunk to the external speech service.

Instead, `SpeechService` maintains a separate buffer for each socket.

Conceptually:

```text
audioBuffers
│
├── socket-A → [chunk, chunk, chunk, ...]
├── socket-B → [chunk, chunk, ...]
└── socket-C → [chunk, chunk, chunk, ...]
```

This lets the system process a user's speech as a sequence of audio rather than thousands of independent tiny requests.

---

# 12. SpeechService.addAudioChunk()

When the backend receives:

```text
audio-chunk
```

it identifies the sender:

```typescript
const speaker = users.get(socket.id);
```

It then calls:

```typescript
speechService.addAudioChunk(
  socket.id,
  audioChunk,
  speaker,
  callback
);
```

`addAudioChunk()` performs several operations.

### 12.1 Create the buffer

If the socket does not have a buffer yet:

```text
audioBuffers.set(socketId, [])
```

### 12.2 Add the chunk

The received binary payload is converted into a Node.js `Buffer`:

```text
Buffer.from(audioChunk)
```

and added to the array.

### 12.3 Start/reset the timer

When a new chunk arrives, the previous timer is reset.

After a period without new data, the accumulated audio is processed.

In the implementation used here, this is approximately:

```text
1500 ms
```

In effect, the absence of new chunks is used as an indication that the speaker has paused.

---

# 13. Buffer Size Limit

There is also a limit on the amount of accumulated data.

In one implementation, the buffer is processed immediately once enough audio has accumulated, for example around several seconds.

The idea is:

```text
speaker talks
     ↓
chunks accumulate
     ↓
pause?
     ├── yes → process
     │
     └── no
          ↓
      buffer too large?
          ├── yes → process
          └── no  → continue buffering
```

This prevents the audio buffer from growing indefinitely when a person speaks continuously.

---

# 14. Building the Full Audio Buffer

When processing begins:

```typescript
const fullAudio = Buffer.concat(buffer);
```

We get:

```text
chunk 1
chunk 2
chunk 3
chunk 4
   ↓
Buffer.concat(...)
   ↓
fullAudio
```

The buffer is then cleared:

```text
audioBuffers[socketId] = []
```

and the timer is removed.

This allows the next phrase to begin accumulating while the previous one is being sent to speech recognition.

---

# 15. Speech-to-Text HTTP Request

The backend sends the accumulated PCM buffer to the external Python service:

```text
POST /speech-to-text
```

with:

```text
Content-Type:
application/octet-stream
```

Request body:

```text
raw PCM bytes
```

The architecture is therefore:

```text
Browser
  ↓
Socket.IO
  ↓
Fastify
  ↓
SpeechService
  ↓
HTTP
  ↓
Python FastAPI
  ↓
/speech-to-text
```

---

# 16. Python Speech Service

The Python service exposes the endpoint:

```text
POST /speech-to-text
```

It accepts:

```text
PCM 16-bit
16 kHz
mono
```

The bytes are then converted into a NumPy array:

```text
bytes
  ↓
np.frombuffer(..., dtype=np.int16)
  ↓
int16 audio
```

The values are then normalized:

```text
Int16
  ↓
Float32
  ↓
[-1.0, 1.0]
```

---

# 17. Silence Check on the Python Side

The Python service also checks amplitude.

If the audio is effectively silent, speech recognition is not started.

This is a second layer of protection:

```text
Frontend silence filter
        +
Backend/Python silence filter
```

This means the system does not rely on a single check.

---

# 18. Speech Recognition Engine

Speech-to-text uses:

```text
faster-whisper
```

with a Whisper model.

The project materials contain both a `base` configuration and a later `small` configuration; the actual project configuration should be treated as the source of truth rather than mixing variants from different development stages.

In this pipeline, the model has one job:

```text
audio
  ↓
Whisper
  ↓
recognized text
```

For example:

```text
PCM audio
    ↓
Whisper
    ↓
"How are you?"
```

or:

```text
PCM audio
    ↓
Whisper
    ↓
"Как дела?"
```

---

# 19. From the Whisper Result to the Callback

After recognition, `SpeechService` receives JSON containing the text.

Условие:

```text
result.text
```

must exist and contain a non-empty string.

The callback is then invoked:

```typescript
callback(result)
```

This is where `SpeechService`'s responsibility ends.

It does not decide:

```text
who should receive a translation
which target language to choose
who should receive the subtitle
```

The WebSocket layer handles those decisions.

---

# 20. Why the WebSocket Layer Knows the Language

When joining a room, the client sends:

```text
nativeLanguage
```

through:

```text
join-room
```

The backend stores this value in the participant/user runtime state.

As a result, the backend knows:

```text
socket A
    → user Ahmed
    → nativeLanguage = en

socket B
    → user Ali
    → nativeLanguage = ru
```

This allows speech to be translated according to each listener's language rather than using one universal target language.

---

# 21. Speaker

When `audio-chunk` arrives, the backend identifies the speaker:

```typescript
const speaker = users.get(socket.id);
```

Therefore:

```text
socket.id
    ↓
users.get(socket.id)
    ↓
speaker
    ├── userId
    ├── userName
    ├── roomId
    └── nativeLanguage
```

The key field for translation is:

```text
speaker.nativeLanguage
```

---

# 22. Finding Listeners

After receiving the text, the backend gets the room:

```text
rooms.get(speaker.roomId)
```

The other participants are stored there.

The speaker is excluded from the listener list:

```text
participantId === socket.id
    → skip
```

The remaining users are potential subtitle recipients.

---

# 23. Grouping Listeners by Language

This is one of the most important parts of the architecture.

Instead of:

```text
translate for user A
translate for user B
translate for user C
```

the system creates:

```text
listenersByLanguage
```

For example:

```text
English
    → [socket-A, socket-C]

Russian
    → [socket-B]
```

This allows the system to perform one translation per target language.

Например, если два участника говорят по-английски, а один по-русскand:

```text
Speaker: Russian

listenersByLanguage:
{
    ru: [socket-1],
    en: [socket-2, socket-3]
}
```

Translation:

```text
Russian → English
```

is performed once.

The result is then sent to both English-speaking listeners.

This is more efficient than making a separate translation request for every user.

---

# 24. Russian → English

Consider a real scenario.

Room participants:

```text
Ahmed → ru
John  → en
Mike  → en
```

Ahmed says:

```text
"Как дела?"
```

Pipeline:

```text
Ahmed microphone
      ↓
AudioSender
      ↓
audio-chunk
      ↓
SpeechService
      ↓
Whisper
      ↓
"Как дела?"
      ↓
speaker.nativeLanguage = "ru"
      ↓
listenersByLanguage
      ├── ru → [Ahmed excluded / other RU listeners]
      └── en → [John, Mike]
      ↓
translationService.translate(...)
      ↓
Russian → English
      ↓
"How are you?"
      ↓
subtitle
      ├── John
      └── Mike
```

---

# 25. English → Russian

Now the reverse scenario.

```text
Ahmed → en
Ali   → ru
```

Ahmed says:

```text
"How are you?"
```

The result is:

```text
speaker.nativeLanguage = "en"
targetLang = "ru"
```

The backend calls:

```typescript
translationService.translate({
  text: "How are you?",
  source: "en",
  target: "ru",
});
```

The Python translation service returns the Russian text.

Ali receives:

```text
"Как дела?"
```

---

# 26. When the Languages Are the Same

No translation is needed.

If:

```text
source === target
```

`TranslationService` immediately returns the original text.

For example:

```text
Speaker: en
Listener: en
```

receives:

```text
originalText
```

without calling the translation service.

То же самое:

```text
Speaker: ru
Listener: ru
```

does not require translation.

---

# 27. TranslationService

Fastify uses:

```text
TranslationService
```

as a bridge between the Node.js backend and the Python translation service.

Method:

```typescript
translationService.translate({
  text,
  source,
  target,
})
```

accepts:

```text
text
source
target
```

For example:

```typescript
{
  text: "Как дела?",
  source: "ru",
  target: "en"
}
```

---

# 28. TranslationService → Python

Node.js выполняет HTTP POST:

```text
POST {TRANSLATION_SERVICE_URL}/translate
```

с JSON:

```json
{
  "text": "Как дела?",
  "source": "ru",
  "target": "en"
}
```

Python service returns:

```json
{
  "translation": "How are you?"
}
```

Node.js returns:

```text
"How are you?"
```

Therefore:

```text
websocket.service
        ↓
translationService
        ↓
HTTP /translate
        ↓
Python
        ↓
MarianMT
        ↓
translation
        ↓
Node.js
```

---

# 29. Translation Engine

Russian ↔ English uses separate MarianMT models:

```text
Russian → English
Helsinki-NLP/opus-mt-ru-en

English → Russian
Helsinki-NLP/opus-mt-en-ru
```

Python translation layer хранит модели в cache:

```text
MODELS
```

Ключом является пара:

```text
(source, target)
```

For example:

```text
("ru", "en")
("en", "ru")
```

Если модель для конкретной пары ещё не загружена, она загружается и сохраняется в памяти.

После этого последующие запросы могут использовать уже загруженную модель.

---

# 30. Why There Are Two Models

Translation:

```text
Russian → English
```

and:

```text
English → Russian
```

is directional.

Поэтому используются две разные моделand:

```text
opus-mt-ru-en
opus-mt-en-ru
```

This is not a single universal translator with a direction parameter inside one model.

Architecturally:

```text
source = ru
target = en
    ↓
opus-mt-ru-en

source = en
target = ru
    ↓
opus-mt-en-ru
```

---

# 31. Translation Error Fallback

TranslationService специально возвращает оригинальный текст при ошибке.

For example:

```text
translation service unavailable
        ↓
return original text
```

If the translation cannot be obtained:

```text
translatedText = originalText
```

The WebSocket layer also has a fallback:

```text
translation error
      ↓
emit subtitle
      ↓
translatedText = result.text
```

Therefore, a translation service failure should not completely break the subtitle pipeline.

The user still receives the recognized original speech.

---

# 32. Subtitle Event

Once the text is ready, the backend sends:

```text
subtitle
```

The payload contains:

```text
originalText
translatedText
speakerId
sourceLanguage
targetLanguage
```

For example:

```json
{
  "originalText": "Как дела?",
  "translatedText": "How are you?",
  "speakerId": "socket123",
  "sourceLanguage": "ru",
  "targetLanguage": "en"
}
```

This event is sent to the specific socket IDs of the listeners.

---

# 33. Why Subtitles Are Sent to Specific Users

Instead of:

```text
io.to(roomId).emit("subtitle", ...)
```

translation pipeline использует конкретные listener IDs.

Причина:

```text
разные участники имеют разные target languages
```

For example:

```text
Speaker: ru

John → en
Ali → ru
```

Нельзя отправить один и тот же subtitle всем.

Поэтому:

```text
John
    ← translatedText

Ali
    ← originalText
```

---

# 34. Frontend Subtitle Listener

On the client, Socket.IO listens for:

```text
subtitle
```

When the event arrives:

```text
socket.on("subtitle", ...)
```

the data is placed into subtitle state.

Conceptually:

```text
Socket.IO
    ↓
subtitle event
    ↓
setSubtitle(...)
    ↓
React state
    ↓
Room UI
```

Therefore, the frontend does not perform speech recognition or translation.

It receives an already processed result.

---

# 35. Why Translation Runs on the Backend

Architecturally, this separates responsibilities.

Frontend:

```text
capture audio
send audio
display result
```

Backend:

```text
identify speaker
buffer audio
call speech service
route languages
call translation service
send subtitle
```

Python:

```text
speech recognition
translation models
```

The result is:

```text
Browser
    = input/output

Node.js
    = orchestration

Python
    = ML processing
```

Это гораздо проще поддерживать, чем запускать большие ML-модели непосредственно внутри браузера.

---

# 36. Where Latency Occurs

Перевод не является мгновенным в физическом смысле.

В pipeline присутствует несколько последовательных этапов:

```text
audio capture
    ↓
chunk collection
    ↓
Socket.IO transmission
    ↓
server buffering
    ↓
speech-to-text request
    ↓
Whisper inference
    ↓
translation request
    ↓
MarianMT inference
    ↓
subtitle event
    ↓
browser rendering
```

Основные источники задержкand:

```text
1. audio chunk buffering
2. pause timeout
3. network transfer
4. Whisper inference
5. translation model inference
6. network transfer обратно
```

Therefore, `real-time` here means a real-time/near-real-time subtitle pipeline, not synchronous translation of every individual audio sample.

---

# 37. Why You Cannot Simply Translate Every Audio Chunk

Because an individual chunk does not necessarily contain a complete semantic unit.

Например, если отправлять:

```text
"How"
```

потом:

```text
"are"
```

потом:

```text
"you"
```

translation engine получает бессмысленные фрагменты.

Therefore, the system first accumulates a sequence of audio and then sends it to speech recognition.

This produces a more meaningful unit:

```text
"How are you?"
```

The text can then be translated.

---

# 38. Why Speech-to-Text Comes Before Translation

The translation model works with text.

Поэтому pipeline обязан пройти through:

```text
audio
   ↓
speech-to-text
   ↓
text
   ↓
translation
   ↓
translated text
```

You cannot simply pass PCM data to MarianMT.

MarianMT expects text input.

---

# 39. Complete Data Flow

The entire mechanism can now be represented by one diagram:

```text
┌──────────────────────┐
│      Microphone      │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│     MediaStream      │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│     AudioSender      │
│                      │
│ AudioContext         │
│ MediaStreamSource    │
│ ScriptProcessor      │
│ Float32 → Int16      │
└──────────┬───────────┘
           ↓
      audio-chunk
           ↓
┌──────────────────────┐
│      Socket.IO       │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ websocket.service.js │
│                      │
│ users.get(socket.id) │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│    SpeechService     │
│                      │
│ buffering            │
│ Buffer.concat        │
└──────────┬───────────┘
           ↓
       HTTP POST
           ↓
┌──────────────────────┐
│   Python FastAPI     │
│   /speech-to-text    │
└──────────┬───────────┘
           ↓
      faster-whisper
           ↓
    recognized text
           ↓
┌──────────────────────┐
│ websocket.service.js │
│                      │
│ speaker language     │
│ listener languages   │
│ listenersByLanguage  │
└──────────┬───────────┘
           ↓
   target language
           ↓
┌──────────────────────┐
│ TranslationService   │
└──────────┬───────────┘
           ↓
       /translate
           ↓
┌──────────────────────┐
│     MarianMT         │
│                      │
│ ru → en              │
│ en → ru              │
└──────────┬───────────┘
           ↓
     translatedText
           ↓
┌──────────────────────┐
│      Socket.IO       │
│       subtitle       │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│     React client     │
│                      │
│     setSubtitle      │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│    Subtitle UI       │
└──────────────────────┘
```

---

# 40. Two Languages: Russian ↔ English

Merriweather does not need an abstract system for dozens of languages.

The target scenario is:

```text
Russian ↔ English
```

Поэтому фактически существуют две translation directions:

```text
ru → en
en → ru
```

There are also two no-translation cases:

```text
ru → ru
en → en
```

Logic:

```text
source === target
    ↓
original text

source !== target
    ↓
translationService
```

---

# 41. Complete Conversation Example

Room:

```text
Ahmed → Russian
John  → English
```

Ahmed says:

```text
"Добро пожаловать!"
```

### Step 1

Ahmed's microphone produces:

```text
MediaStream
```

### Step 2

`AudioSender` extracts PCM.

### Step 3

PCM is sent through:

```text
audio-chunk
```

### Step 4

The backend determines:

```text
speaker = Ahmed
speaker.nativeLanguage = ru
```

### Step 5

SpeechService accumulates the audio.

### Step 6

Python Whisper recognizes:

```text
"Добро пожаловать!"
```

### Step 7

The backend sees:

```text
targetLang = en
```

### Step 8

It calls:

```text
translationService.translate({
    text: "Добро пожаловать!",
    source: "ru",
    target: "en"
})
```

### Step 9

MarianMT:

```text
ru → en
```

returns:

```text
"Welcome!"
```

### Step 10

John receives:

```text
subtitle
{
    originalText: "Добро пожаловать!",
    translatedText: "Welcome!"
}
```

### Step 11

React updates the subtitle state.

### Step 12

John sees:

```text
Welcome!
```

---

# 42. What Happens When an ML Service Fails

If the speech service is unavailable:

```text
Fastify
   ↓
/speech-to-text
   ↓
error
```

`SpeechService` не вызывает callback с пустым/невалидным результатом.

If the translation service is unavailable:

```text
TranslationService
   ↓
error
   ↓
return original text
```

Therefore:

```text
Speech recognition failure
    → no subtitle result

Translation failure
    → original recognized text
```

Это два разных failure mode.

---

# 43. Cleanup

При disconnect:

```text
socket.on("disconnect")
```

backend вызывает:

```text
speechService.cleanup(socket.id)
```

Очистка удаляет:

```text
audioBuffers
processingTimers
```

Это необходимо, потому что иначе после отключения пользователя его аудиобуфер мог бы остаться в памяти.

On the frontend, `AudioSender.stop()`:

```text
isActive = false
↓
ScriptProcessor disconnect
↓
MediaStreamSource disconnect
↓
AudioContext.close()
↓
references = null
```

This cleans up both the frontend audio graph and the backend audio buffer.

---

# 44. Why This Is a Real-Time Pipeline

The architecture does not wait for the entire meeting to end.

It operates continuously:

```text
говорит
  ↓
audio chunks
  ↓
buffer
  ↓
speech recognition
  ↓
text
  ↓
translation
  ↓
subtitle
  ↓
снова audio chunks
```

The next phrase is processed independently of the previous one.

This makes the system streaming-oriented architecturally, even though individual stages process data in batches.

---

# 45. Important Terminology Note

During a project demonstration, it is better not to say:

> «Мы переводим голос напрямую в реальном времени».

A more technically accurate explanation is:

> «Мы захватываем аудио в реальном времени, разбиваем его на PCM chunks, передаём их через Socket.IO, на backend буферизуем аудио, отправляем его в faster-whisper для speech-to-text, затем маршрутизируем recognized text по языкам слушателей и при необходимости переводим его через MarianMT. После этого backend отправляет каждому слушателю realtime subtitle.»

This is a much stronger technical explanation because it demonstrates that you understand every intermediate stage.

---

# 46. Why the Architecture Is Split Between Node.js and Python

Node.js does not perform the ML inference itself.

It acts as the orchestration layer:

```text
Socket.IO
    ↓
SpeechService
    ↓
TranslationService
```

Python выполняет тяжёлые ML операциand:

```text
faster-whisper
MarianMT
```

The result is:

```text
Node.js
    = realtime coordination

Python
    = machine learning inference
```

This also allows the speech or translation model to be replaced independently without rewriting the entire Socket.IO layer.

---

# 47. Main Files

Ключевые участки реализациand:

```text
Frontend
├── audio-sender.ts
│     └── audio capture + PCM conversion
│
└── use-socket.ts
      ├── audio-chunk
      ├── join-room
      └── subtitle

Backend
├── websocket.service.js
│     └── realtime orchestration
│
├── speech.service.js
│     └── audio buffering + speech HTTP bridge
│
└── translation.service.js
      └── translation HTTP bridge

Python
├── app.py
│     ├── /speech-to-text
│     └── /translate
│
└── translator.py
      ├── opus-mt-ru-en
      └── opus-mt-en-ru
```

---

# 48. The Main Idea of the System

Если убрать все детали, архитектура сводится к следующему:

```text
AUDIO
  ↓
SPEECH
  ↓
TEXT
  ↓
LANGUAGE ROUTING
  ↓
TRANSLATION
  ↓
SUBTITLE
```

А инфраструктурно:

```text
Browser
   ↓
Socket.IO
   ↓
Fastify
   ↓
Python ML service
   ↓
Fastify
   ↓
Socket.IO
   ↓
Browser
```

Именно это является главным техническим ядром realtime translation в Merriweather.

---

# 49. What a Developer Should Be Able to Explain After Studying This Document

After studying this document, a developer should understand:

1. Откуда берётся `MediaStream`.
2. Почему translation pipeline использует тот же `MediaStream`, что и WebRTC.
3. Что делает `AudioSender`.
4. Зачем нужен `AudioContext`.
5. Что делает `ScriptProcessorNode`.
6. Почему используется PCM Int16.
7. Что именно передаётся через `audio-chunk`.
8. Почему backend буферизует chunks.
9. Что делает `SpeechService.addAudioChunk()`.
10. Как PCM попадает в Python.
11. Как faster-whisper превращает audio в text.
12. Как backend определяет speaker.
13. Как backend определяет язык speaker.
14. Как работают `rooms` и `users`.
15. Что такое `listenersByLanguage`.
16. Почему один перевод можно отправить нескольким пользователям.
17. Почему `ru → ru` и `en → en` не требуют translation request.
18. Как работает `TranslationService`.
19. Какие MarianMT модели используются для RU ↔ EN.
20. Как работает fallback при ошибке перевода.
21. Что находится внутри `subtitle`.
22. Как subtitle возвращается на frontend.
23. Где возникает latency.
24. Как выполняется cleanup.
25. Почему WebRTC media transport и translation pipeline являются разными потоками обработки.

Если разработчик может последовательно объяснить этот путь без подсказкand:

```text
Microphone
→ MediaStream
→ AudioSender
→ PCM
→ audio-chunk
→ Socket.IO
→ SpeechService
→ faster-whisper
→ text
→ listenersByLanguage
→ MarianMT
→ translatedText
→ subtitle
→ React
```

then they genuinely understand how Merriweather's main real-time feature is implemented rather than merely knowing that “it has Whisper and translation.”
