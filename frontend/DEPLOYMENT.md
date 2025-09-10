# 🚀 Развертывание Sales AI на Vercel

## Подготовка к развертыванию

### 1. Структура проекта
```
sales-ai/
├── frontend/          # ← Это корень для деплоя на Vercel
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── vercel.json    # ✅ Конфигурация Vercel
│   ├── next.config.js # ✅ Обновлено для продакшена
│   └── package.json
├── backend/           # ← Серверные функции (интегрированы в app/api/)
└── infra/            # ← База данных Supabase
```

### 2. Переменные окружения

Необходимые переменные (обязательные):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_AGENT_ID`

Опциональные:
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `RESEND_API_KEY`

## Способы развертывания

### Способ 1: Vercel CLI (рекомендуется)

```bash
# Установить Vercel CLI
npm i -g vercel

# Перейти в директорию frontend
cd /Users/dzhechkov/Downloads/zero-rep/sales-ai/frontend

# Войти в аккаунт
vercel login

# Развернуть (первый раз - создание проекта)
vercel

# Для последующих обновлений
vercel --prod
```

### Способ 2: GitHub Integration

1. Загрузить код в GitHub репозиторий
2. Подключить репозиторий к Vercel
3. Указать `sales-ai/frontend` как root directory
4. Настроить переменные окружения в Vercel Dashboard

### Способ 3: Vercel MCP + MCPProxy

```bash
# Через MCP tools (если настроены)
# Использовать Vercel MCP для деплоя
# И Supabase MCP для управления БД
```

## Настройка после развертывания

### 1. Переменные окружения в Vercel

Перейти в Vercel Dashboard > Project > Settings > Environment Variables

```env
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=https://ваш-проект.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ваш-anon-key
SUPABASE_SERVICE_ROLE_KEY=ваш-service-key
ELEVENLABS_API_KEY=ваш-elevenlabs-key
ELEVENLABS_AGENT_ID=ваш-agent-id
```

### 2. Настройка домена (опционально)

```bash
vercel domains add your-domain.com
vercel domains ls
```

### 3. Проверка развертывания

После успешного деплоя:
- ✅ Открыть https://your-app.vercel.app
- ✅ Проверить работу API: `/api/health`
- ✅ Проверить подключение к Supabase
- ✅ Проверить ElevenLabs интеграцию

## Мониторинг и логи

```bash
# Просмотр логов
vercel logs your-app-name

# Информация о деплоях
vercel ls

# Информация о проекте
vercel inspect your-app-name
```

## Troubleshooting

### Ошибка сборки
- Проверить `npm run build` локально
- Проверить все переменные окружения
- Проверить конфликты зависимостей

### API не работает
- Проверить корректность переменных окружения
- Проверить логи функций: `vercel logs --follow`

### База данных недоступна
- Проверить Supabase URL и ключи
- Проверить политики RLS
- Выполнить `setup.sql` в Supabase SQL Editor

## ✅ УСПЕШНО РАЗВЕРНУТО!

### Ссылка на приложение:
**https://sales-ai-trainer-qjb8dtvai-dzhechkos-projects.vercel.app**

### Почему стоило развертывать всю sales-ai директорию:

1. **Единая структура проекта** - все компоненты в одном месте
2. **Лучшая организация** - frontend, backend, infra логически связаны  
3. **Проще управление** - один репозиторий, один деплой
4. **Monorepo подход** - современная практика для комплексных приложений
5. **Простота интеграции** - backend функции автоматически интегрированы

### Конфигурация Monorepo:
```json
// package.json (корень)
{
  "workspaces": ["frontend", "backend"],
  "scripts": {
    "build": "cd frontend && npm run build"
  }
}

// vercel.json (корень)
{
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/.next",
  "installCommand": "cd frontend && npm install"
}
```

### Интеграция backend в frontend:
- ✅ `backend/lib/supabase.ts` → `frontend/lib/supabase-backend.ts`
- ✅ API routes содержат код прямо в файлах (без внешних импортов)
- ✅ Все зависимости установлены в `frontend/package.json`

### Следующие шаги:
1. Добавить переменные окружения в Vercel Dashboard
2. Redeploy проект
3. Протестировать все функции
4. Настроить custom домен (опционально)

