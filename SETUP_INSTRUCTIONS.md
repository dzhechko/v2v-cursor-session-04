# 🚀 Инструкции по настройке Supabase с префиксами

## ШАГ 1: Применение схемы базы данных

### 1.1 Откройте Supabase Dashboard
1. Перейдите на [supabase.com/dashboard](https://supabase.com/dashboard)
2. Откройте ваш проект
3. Перейдите в раздел **"SQL Editor"**

### 1.2 Примените схему
1. Откройте файл `infra/supabase/setup.sql`
2. Скопируйте **весь** код из файла
3. Вставьте в SQL Editor в Supabase
4. Нажмите **"Run"** для выполнения

✅ **Результат**: Увидите сообщение "Setup completed!" и список созданных таблиц с префиксом `salesai_`

## ШАГ 2: Настройка переменных окружения

### 2.1 Получите данные из Supabase
1. В Supabase Dashboard перейдите в **Settings** → **API**
2. Скопируйте:
   - **Project URL** (Project URL)
   - **anon public** ключ
   - **service_role** ключ (secret)

### 2.2 Обновите .env файл
1. Откройте файл `.env` в корне проекта
2. Замените значения:

```env
# Замените эти значения на ваши данные из Supabase
NEXT_PUBLIC_SUPABASE_URL=https://ваш-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ваш-anon-key
SUPABASE_SERVICE_ROLE_KEY=ваш-service-role-key

# ОБЯЗАТЕЛЬНО: ElevenLabs для голосового тренинга
ELEVENLABS_API_KEY=ваш-elevenlabs-api-key
ELEVENLABS_AGENT_ID=ваш-elevenlabs-agent-id

# Дополнительные API ключи (для production)
OPENAI_API_KEY=ваш-openai-api-key
STRIPE_SECRET_KEY=ваш-stripe-secret-key
RESEND_API_KEY=ваш-resend-api-key
```

## ШАГ 3: Настройка ElevenLabs (ОБЯЗАТЕЛЬНО!)

### 3.1 Создайте аккаунт ElevenLabs
1. Перейдите на [elevenlabs.io](https://elevenlabs.io)
2. Зарегистрируйтесь или войдите в аккаунт
3. Получите API ключ в разделе **Profile** → **API Keys**

### 3.2 Создайте Conversational AI Agent
1. В ElevenLabs Dashboard перейдите в **Conversational AI**
2. Нажмите **"Create Agent"**
3. Настройте агента:
   - **Name**: "Sales Training AI"
   - **Role**: "You are a potential client interested in sales training. Ask challenging questions, present realistic objections, and help the salesperson practice their pitch."
   - **Voice**: Выберите подходящий голос
4. Сохраните и скопируйте **Agent ID**

### 3.3 Обновите переменные окружения
Добавьте в ваш `.env.local` файл в папке `frontend/`:

```env
ELEVENLABS_API_KEY=ваш-api-key-из-step-3.1
ELEVENLABS_AGENT_ID=ваш-agent-id-из-step-3.2
```

⚠️ **ВАЖНО**: Без этих ключей голосовой тренинг не будет работать!

## ШАГ 4: Тестирование подключения

### 4.1 Запуск приложения
```bash
cd /Users/dzhechkov/Downloads/zero-rep/sales-ai/frontend
npm run dev
```

### 4.2 Проверка подключения
1. Откройте [http://localhost:3000](http://localhost:3000)
2. Нажмите **"Try Free Demo"**
3. Заполните форму на странице **"Get Your Personalized Demo"**
4. Вас перенаправит на страницу голосового тренинга
5. Нажмите **"Start Training"** 
6. Если появится "Connected to live AI trainer!" - всё работает! ✅

### 4.3 Что проверить
- ✅ Голосовое подключение к ElevenLabs AI
- ✅ Микрофон работает
- ✅ AI отвечает голосом
- ✅ Запись разговора в реальном времени

## ШАГ 4: Настройка API ключей (для полной функциональности)

### 4.1 ElevenLabs API
1. Получите API ключ и Agent ID от ElevenLabs
2. Обновите в `.env`:
```env
ELEVENLABS_API_KEY=ваш-elevenlabs-api-key
ELEVENLABS_AGENT_ID=ваш-agent-id
```

### 4.2 OpenAI API (для анализа)
```env
OPENAI_API_KEY=ваш-openai-api-key
```

## ⚡ Быстрая проверка

Выполните в SQL Editor Supabase:
```sql
-- Проверьте созданные таблицы
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'salesai_%'
ORDER BY table_name;
```

Должно показать 11 таблиц с префиксом `salesai_`.

## 🚨 Возможные проблемы

### "Invalid authorization token"
- Проверьте правильность ключей в `.env`
- Убедитесь, что service_role ключ скопирован полностью

### "User profile not found"
- Нужно создать пользователя через Supabase Auth
- Или временно отключить проверки для тестирования

### Таблицы не создались
- Проверьте права доступа в Supabase
- Убедитесь, что выполнили весь `setup.sql` файл

## 🎯 Следующие шаги

После успешной настройки базы данных:
1. **Настроить аутентификацию** - Supabase Auth UI
2. **Добавить ElevenLabs интеграцию** - полнофункциональные голосовые сессии
3. **Настроить OpenAI анализ** - обратная связь по сессиям

## 📞 Готово!

Если все работает - схема с префиксами `salesai_` успешно применена и не конфликтует с вашими существующими данными! ✅
