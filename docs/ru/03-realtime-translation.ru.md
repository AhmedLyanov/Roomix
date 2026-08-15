# Roomix— Перевод речи в реальном времени

## 1. Назначение

Перевод речи в реальном времени — одна из главных технических возможностей Roomix.

Система позволяет участникам одной комнаты говорить на двух поддерживаемых языках:

```text
Russian ↔ English
```

Основная идея не заключается в том, чтобы переводить весь аудиопоток WebRTC. Для перевода создаётся отдельный путь обработки аудио:

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
распознанный текст
   ↓
определение языков слушателей
   ↓
группировка слушателей по языку
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

Это важно: WebRTC отвечает за обычную передачу аудио и видео между участниками, а translation pipeline отдельно получает аудиоданные из локального `MediaStream` и обрабатывает их для субтитров.

---

# 2. Полная архитектура

Перевод состоит из нескольких самостоятельных частей:

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

# 3. Откуда берётся аудио

Компонент/хук `useMedia` получает браузерный `MediaStream`.

В этом потоке присутствуют аудиодорожка и видеодорожка.

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

То есть система не создаёт отдельный микрофонный поток специально для перевода.

Она использует уже существующий `MediaStream`.

Это позволяет одновременно:

1. отправлять аудио через WebRTC;
2. извлекать аудиоданные для speech-to-text.

---

# 4. AudioSender

`AudioSender` является frontend-компонентом, который отвечает за подготовку аудио для speech recognition.

Он получает:

```typescript
start(stream: MediaStream)
```

и сохраняет переданный поток.

Основные внутренние объекты:

```text
AudioContext
MediaStreamAudioSourceNode
ScriptProcessorNode
MediaStream
Socket
```

В текущей реализации для захвата аудио используется `ScriptProcessorNode`.

Это важно не путать с `AudioWorklet`: в исходном коде, который использует проект, основной путь захвата реализован через `ScriptProcessorNode`. В материалах проекта также рассматривался переход на `AudioWorklet`, но это уже отдельное изменение архитектуры, а не то, что следует автоматически приписывать текущему flow.

---

# 5. AudioContext

`AudioSender` создаёт:

```typescript
new AudioContext({
  sampleRate: 16000,
});
```

Целевая частота дискретизации:

```text
16 kHz
```

Это соответствует формату, который ожидает speech-to-text pipeline.

Далее создаётся источник:

```typescript
audioContext.createMediaStreamSource(stream);
```

Он подключает аудиодорожку существующего `MediaStream` к Web Audio API.

Получается:

```text
MediaStream
    ↓
MediaStreamAudioSourceNode
    ↓
AudioContext
```

---

# 6. ScriptProcessor

Для извлечения аудиоданных используется:

```typescript
audioContext.createScriptProcessor(4096, 1, 1);
```

Здесь:

```text
4096
    = размер буфера

1
    = один входной канал

1
    = один выходной канал
```

Когда браузер предоставляет очередной блок аудиоданных, вызывается:

```typescript
onaudioprocess;
```

Из события берётся:

```typescript
event.inputBuffer.getChannelData(0);
```

Результат:

```text
Float32Array
```

То есть на этом этапе звук представлен как массив floating-point audio samples.

---

# 7. Проверка микрофона

Перед отправкой AudioSender проверяет состояние:

```text
isActive
isMicEnabled
```

Если захват остановлен:

```text
isActive === false
```

аудио не отправляется.

Если микрофон выключен:

```text
isMicEnabled === false
```

аудио также не отправляется.

Это позволяет синхронизировать translation pipeline с состоянием микрофона.

---

# 8. Фильтрация тишины

Перед отправкой система проверяет амплитуду входного блока.

Используется порог, например:

```text
0.01
```

Если максимальная амплитуда блока ниже порога, блок считается тишиной и не отправляется.

Концептуально:

```text
audio chunk
    ↓
max amplitude
    ↓
< threshold?
   ├── yes → discard
   └── no  → process
```

Это уменьшает количество бессмысленных аудиоданных, которые пришлось бы передавать на backend и отправлять в speech recognition.

---

# 9. Float32 → Int16 PCM

Web Audio API предоставляет samples как:

```text
Float32Array
```

Но backend/Python speech endpoint принимает:

```text
PCM 16-bit
```

Поэтому выполняется преобразование:

```text
Float32
   ↓
clamp [-1, 1]
   ↓
Int16
```

Логика преобразования:

```text
negative sample
    → sample × 0x8000

positive sample
    → sample × 0x7FFF
```

Результат:

```text
Int16Array
```

После этого отправляется его underlying buffer:

```typescript
pcmData.buffer;
```

Таким образом, через Socket.IO передаются бинарные PCM-данные, а не текст.

---

# 10. Audio chunk

Каждый подготовленный блок отправляется через:

```text
audio-chunk
```

Направление:

```text
Client
   ↓
Socket.IO
   ↓
Backend
```

Payload представляет собой бинарные данные PCM.

В конкретной реализации `AudioSender` отправляет:

```typescript
socket.emit("audio-chunk", pcmData.buffer);
```

Это важный момент для объяснения архитектуры:

```text
audio-chunk
    ≠
audio file

audio-chunk
    =
часть PCM audio buffer
```

---

# 11. Зачем нужна серверная буферизация

Если отправлять каждый маленький audio chunk непосредственно в speech recognition, система будет создавать огромное количество отдельных запросов.

Поэтому backend не отправляет каждый chunk сразу во внешний speech service.

Вместо этого `SpeechService` хранит буфер отдельно для каждого socket.

Концептуально:

```text
audioBuffers
│
├── socket-A → [chunk, chunk, chunk, ...]
├── socket-B → [chunk, chunk, ...]
└── socket-C → [chunk, chunk, chunk, ...]
```

Это позволяет обрабатывать речь пользователя как последовательность аудио, а не как тысячи независимых микроскопических запросов.

---

# 12. SpeechService.addAudioChunk()

Когда backend получает:

```text
audio-chunk
```

он определяет отправителя:

```typescript
const speaker = users.get(socket.id);
```

После этого вызывает:

```typescript
speechService.addAudioChunk(socket.id, audioChunk, speaker, callback);
```

`addAudioChunk()` делает несколько вещей.

### 12.1 Создаёт buffer

Если для socket ещё нет буфера:

```text
audioBuffers.set(socketId, [])
```

### 12.2 Добавляет chunk

Полученный binary payload преобразуется в Node.js `Buffer`:

```text
Buffer.from(audioChunk)
```

и добавляется в массив.

### 12.3 Запускает/reset timer

При поступлении нового chunk предыдущий timer сбрасывается.

После периода без новых данных запускается обработка накопленного аудио.

В используемой реализации это примерно:

```text
1500 ms
```

То есть система фактически использует отсутствие новых chunks как признак паузы говорящего.

---

# 13. Ограничение размера буфера

Помимо таймера существует ограничение по объёму накопленных данных.

В одной из реализаций буфер обрабатывается немедленно, когда накопилось достаточно аудио, например около нескольких секунд.

Идея:

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

Это предотвращает бесконечное накопление аудио, если человек говорит непрерывно.

---

# 14. Формирование полного audio buffer

Когда приходит время обработки:

```typescript
const fullAudio = Buffer.concat(buffer);
```

Получаем:

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

После этого буфер очищается:

```text
audioBuffers[socketId] = []
```

и timer удаляется.

Это позволяет сразу начать накапливать следующую фразу, пока предыдущая отправляется на speech recognition.

---

# 15. Speech-to-Text HTTP request

Backend отправляет накопленный PCM buffer во внешний Python service:

```text
POST /speech-to-text
```

с:

```text
Content-Type:
application/octet-stream
```

Тело запроса:

```text
raw PCM bytes
```

То есть архитектура выглядит так:

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

Python-сервис предоставляет endpoint:

```text
POST /speech-to-text
```

Он принимает:

```text
PCM 16-bit
16 kHz
mono
```

Далее bytes преобразуются в NumPy array:

```text
bytes
  ↓
np.frombuffer(..., dtype=np.int16)
  ↓
int16 audio
```

После этого значения нормализуются:

```text
Int16
  ↓
Float32
  ↓
[-1.0, 1.0]
```

---

# 17. Проверка тишины на Python-стороне

Python service также выполняет проверку амплитуды.

Если аудио практически полностью тихое, speech recognition не запускается.

Это второй уровень защиты:

```text
Frontend silence filter
        +
Backend/Python silence filter
```

Таким образом, система не полагается только на одну проверку.

---

# 18. Speech Recognition Engine

Для speech-to-text используется:

```text
faster-whisper
```

с моделью Whisper.

В проектных материалах присутствуют конфигурации модели `base` и более поздняя конфигурация `small`; документация должна рассматривать фактически используемую конфигурацию проекта как источник истины, а не смешивать варианты из разных этапов разработки.

В текущем описываемом pipeline задача модели одна:

```text
audio
  ↓
Whisper
  ↓
recognized text
```

Например:

```text
PCM audio
    ↓
Whisper
    ↓
"How are you?"
```

или:

```text
PCM audio
    ↓
Whisper
    ↓
"Как дела?"
```

---

# 19. От результата Whisper к callback

После распознавания `SpeechService` получает JSON с текстом.

Условие:

```text
result.text
```

должен существовать и содержать непустую строку.

После этого вызывается callback:

```typescript
callback(result);
```

Именно здесь заканчивается responsibility `SpeechService`.

Он не решает:

```text
кому переводить
какой язык выбрать
кому отправить subtitle
```

Этим занимается websocket layer.

---

# 20. Почему websocket layer знает язык

При входе в комнату клиент отправляет:

```text
nativeLanguage
```

через:

```text
join-room
```

Backend сохраняет этот параметр в participant/user runtime state.

В результате backend знает:

```text
socket A
    → user Ahmed
    → nativeLanguage = en

socket B
    → user Ali
    → nativeLanguage = ru
```

Это позволяет переводить речь не абстрактно, а специально под язык каждого слушателя.

---

# 21. Speaker

Когда приходит `audio-chunk`, backend определяет говорящего:

```typescript
const speaker = users.get(socket.id);
```

Таким образом:

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

Ключевое поле для перевода:

```text
speaker.nativeLanguage
```

---

# 22. Поиск слушателей

После получения текста backend получает комнату:

```text
rooms.get(speaker.roomId)
```

Там находятся остальные участники.

Говорящий сам исключается из списка слушателей:

```text
participantId === socket.id
    → skip
```

Остальные пользователи являются потенциальными получателями subtitle.

---

# 23. Группировка слушателей по языку

Это одна из наиболее важных частей архитектуры.

Вместо:

```text
translate for user A
translate for user B
translate for user C
```

создаётся:

```text
listenersByLanguage
```

Например:

```text
English
    → [socket-A, socket-C]

Russian
    → [socket-B]
```

Это позволяет выполнить один перевод для каждого целевого языка.

Например, если два участника говорят по-английски, а один по-русски:

```text
Speaker: Russian

listenersByLanguage:
{
    ru: [socket-1],
    en: [socket-2, socket-3]
}
```

Перевод:

```text
Russian → English
```

выполняется один раз.

Результат затем отправляется обоим английским слушателям.

Это существенно лучше, чем делать отдельный translation request для каждого пользователя.

---

# 24. Russian → English

Рассмотрим реальный сценарий.

В комнате:

```text
Ahmed → ru
John  → en
Mike  → en
```

Ahmed говорит:

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

Теперь обратный сценарий.

```text
Ahmed → en
Ali   → ru
```

Ahmed говорит:

```text
"How are you?"
```

Получается:

```text
speaker.nativeLanguage = "en"
targetLang = "ru"
```

Backend вызывает:

```typescript
translationService.translate({
  text: "How are you?",
  source: "en",
  target: "ru",
});
```

Python translation service возвращает русский текст.

Ali получает:

```text
"Как дела?"
```

---

# 26. Если язык одинаковый

Перевод не нужен.

Если:

```text
source === target
```

`TranslationService` сразу возвращает исходный текст.

Например:

```text
Speaker: en
Listener: en
```

получает:

```text
originalText
```

без обращения к translation service.

То же самое:

```text
Speaker: ru
Listener: ru
```

не требует перевода.

---

# 27. TranslationService

Fastify использует:

```text
TranslationService
```

как bridge между Node.js backend и Python translation service.

Метод:

```typescript
translationService.translate({
  text,
  source,
  target,
});
```

принимает:

```text
text
source
target
```

Например:

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

Python service возвращает:

```json
{
  "translation": "How are you?"
}
```

Node.js возвращает:

```text
"How are you?"
```

Таким образом:

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

Для Russian ↔ English используются отдельные модели MarianMT:

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

Например:

```text
("ru", "en")
("en", "ru")
```

Если модель для конкретной пары ещё не загружена, она загружается и сохраняется в памяти.

После этого последующие запросы могут использовать уже загруженную модель.

---

# 30. Почему две модели

Перевод:

```text
Russian → English
```

и:

```text
English → Russian
```

является направленным.

Поэтому используются две разные модели:

```text
opus-mt-ru-en
opus-mt-en-ru
```

Это не один универсальный translator с параметром направления внутри одной модели.

Архитектурно:

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

# 31. Fallback при ошибке перевода

TranslationService специально возвращает оригинальный текст при ошибке.

Например:

```text
translation service unavailable
        ↓
return original text
```

Если перевод не удалось получить:

```text
translatedText = originalText
```

На websocket уровне также существует fallback:

```text
translation error
      ↓
emit subtitle
      ↓
translatedText = result.text
```

Поэтому отказ translation service не должен полностью уничтожить subtitle pipeline.

Пользователь хотя бы получает распознанную оригинальную речь.

---

# 32. Subtitle Event

После того как текст готов, backend отправляет:

```text
subtitle
```

Payload содержит:

```text
originalText
translatedText
speakerId
sourceLanguage
targetLanguage
```

Например:

```json
{
  "originalText": "Как дела?",
  "translatedText": "How are you?",
  "speakerId": "socket123",
  "sourceLanguage": "ru",
  "targetLanguage": "en"
}
```

Это событие отправляется конкретным socket IDs слушателей.

---

# 33. Почему subtitle отправляется конкретным пользователям

Вместо:

```text
io.to(roomId).emit("subtitle", ...)
```

translation pipeline использует конкретные listener IDs.

Причина:

```text
разные участники имеют разные target languages
```

Например:

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

# 34. Frontend subtitle listener

На клиенте Socket.IO подписан на:

```text
subtitle
```

Когда событие приходит:

```text
socket.on("subtitle", ...)
```

данные передаются в состояние subtitle.

Концептуально:

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

Таким образом frontend не занимается speech recognition и не занимается translation.

Он получает уже подготовленный результат.

---

# 35. Почему перевод находится на backend

Архитектурно это позволяет разделить ответственность.

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

Получается:

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

# 36. Где возникает задержка

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

Основные источники задержки:

```text
1. audio chunk buffering
2. pause timeout
3. network transfer
4. Whisper inference
5. translation model inference
6. network transfer обратно
```

Поэтому термин `real-time` здесь означает realtime/near-realtime subtitle pipeline, а не синхронный перевод каждого audio sample.

---

# 37. Почему нельзя просто переводить каждый audio chunk

Потому что chunk сам по себе не обязательно содержит законченный смысл.

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

Поэтому система сначала накапливает последовательность аудио, затем отправляет её в speech recognition.

Получается более осмысленная единица:

```text
"How are you?"
```

После этого уже можно переводить текст.

---

# 38. Почему сначала Speech-to-Text, а потом Translation

Translation model работает с текстом.

Поэтому pipeline обязан пройти через:

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

Нельзя просто передать PCM в MarianMT.

MarianMT ожидает текстовый input.

---

# 39. Полный Data Flow

Теперь весь механизм можно представить одной схемой:

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

# 40. Два языка: Russian ↔ English

В Roomixне требуется строить абстрактную систему для десятков языков.

Целевой сценарий:

```text
Russian ↔ English
```

Поэтому фактически существуют две translation directions:

```text
ru → en
en → ru
```

И два типа поведения без перевода:

```text
ru → ru
en → en
```

Логика:

```text
source === target
    ↓
original text

source !== target
    ↓
translationService
```

---

# 41. Пример полного разговора

Комната:

```text
Ahmed → Russian
John  → English
```

Ahmed говорит:

```text
"Добро пожаловать!"
```

### Шаг 1

Микрофон Ahmed создаёт:

```text
MediaStream
```

### Шаг 2

`AudioSender` извлекает PCM.

### Шаг 3

PCM отправляется:

```text
audio-chunk
```

### Шаг 4

Backend определяет:

```text
speaker = Ahmed
speaker.nativeLanguage = ru
```

### Шаг 5

SpeechService собирает аудио.

### Шаг 6

Python Whisper распознаёт:

```text
"Добро пожаловать!"
```

### Шаг 7

Backend видит:

```text
targetLang = en
```

### Шаг 8

Вызывается:

```text
translationService.translate({
    text: "Добро пожаловать!",
    source: "ru",
    target: "en"
})
```

### Шаг 9

MarianMT:

```text
ru → en
```

возвращает:

```text
"Welcome!"
```

### Шаг 10

John получает:

```text
subtitle
{
    originalText: "Добро пожаловать!",
    translatedText: "Welcome!"
}
```

### Шаг 11

React обновляет subtitle state.

### Шаг 12

John видит:

```text
Welcome!
```

---

# 42. Что происходит при отказе ML-сервиса

Если speech service не работает:

```text
Fastify
   ↓
/speech-to-text
   ↓
error
```

`SpeechService` не вызывает callback с пустым/невалидным результатом.

Если translation service не работает:

```text
TranslationService
   ↓
error
   ↓
return original text
```

Таким образом:

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

На frontend `AudioSender.stop()`:

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

Таким образом очищается как frontend audio graph, так и backend audio buffer.

---

# 44. Почему это именно realtime pipeline

Архитектура не ждёт окончания всей встречи.

Она работает непрерывно:

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

Следующая фраза обрабатывается независимо от предыдущей.

Это делает систему потоковой по архитектуре, хотя отдельные этапы выполняются пакетами.

---

# 45. Важное ограничение терминологии

На демонстрации проекта лучше не говорить:

> «Мы переводим голос напрямую в реальном времени».

Технически точнее:

> «Мы захватываем аудио в реальном времени, разбиваем его на PCM chunks, передаём их через Socket.IO, на backend буферизуем аудио, отправляем его в faster-whisper для speech-to-text, затем маршрутизируем распознанный текст по языкам слушателей и при необходимости переводим его через MarianMT. После этого backend отправляет каждому слушателю realtime subtitle.»

Это гораздо сильнее звучит на технической демонстрации, потому что показывает, что ты понимаешь каждый промежуточный этап.

---

# 46. Почему эта архитектура разделена на Node.js и Python

Node.js здесь не занимается непосредственно ML inference.

Он выступает как orchestration layer:

```text
Socket.IO
    ↓
SpeechService
    ↓
TranslationService
```

Python выполняет тяжёлые ML операции:

```text
faster-whisper
MarianMT
```

Получается:

```text
Node.js
    = realtime coordination

Python
    = machine learning inference
```

Это также позволяет независимо заменить speech или translation model, не переписывая весь Socket.IO слой.

---

# 47. Основные файлы

Ключевые участки реализации:

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

# 48. Главная идея всей системы

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

Именно это является главным техническим ядром realtime translation в Roomix.

---

# 49. Что разработчик должен уметь объяснить после изучения документа

После изучения этого документа необходимо понимать:

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

Если разработчик может последовательно объяснить этот путь без подсказки:

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

то он действительно понимает, как реализована главная realtime-фича Roomix, а не просто знает, что «там есть Whisper и перевод».
