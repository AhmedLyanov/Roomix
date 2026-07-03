# FSD Архитектура Merriweather Video Conference

## Структура

```
web/
  features/
    room-session/          # Feature управления видео-сессией
      model/
        useRoomSession.ts  # Главный хук для WebRTC логики
      index.ts
    room-control/          # Feature управления панелью комнаты
      ui/
        room-control.tsx   # Компонент с кнопками управления
    share-link/            # Feature общей ссылки
      ui/
        share-link.tsx     # Компонент копирования ссылки
    create-lesson/         # Feature создания урока
    theme-switch/          # Feature переключения темы
    index.ts               # Экспорт всех features

  shared/
    lib/
      hooks/
        useFullscreen.ts   # Хук для полноэкрана
      grid/
        gridLayout.ts      # Утилита расчета сетки видео
      cn.ts                # Утилита для классов
      index.ts
    ui/                    # Общие UI компоненты
    icons/                 # Иконки

  app/
    (room)/
      room/
        [roomId]/
          page.tsx         # Server page с интеграцией features

  components/
    room/
      RoomClient.tsx       # Client компонент для видео-грида
```

## Как это работает

1. **useRoomSession** (features/room-session/model/useRoomSession.ts)
   - Управляет подключением к WebSocket серверу
   - Обрабатывает WebRTC логику (simple-peer)
   - Возвращает состояние и обработчики

2. **RoomControl** (features/room-control/ui/room-control.tsx)
   - Получает props от page.tsx (состояние камеры, микрофона, ссылку на функции)
   - Отображает кнопки управления с правильными визуальными состояниями

3. **ShareLink** (features/share-link/ui/share-link.tsx)
   - Получает roomUrl prop
   - Позволяет копировать ссылку приглашения

4. **RoomClient** (components/room/RoomClient.tsx)
   - Client компонент для отрисовки видео
   - Использует useRoomSession hook
   - Управляет видео-гридом

5. **Page** (app/(room)/room/[roomId]/page.tsx)
   - Server компонент (client directive)
   - Использует useRoomSession для получения состояния
   - Передает props в RoomControl с обработчиками функций
   - Отображает количество участников
