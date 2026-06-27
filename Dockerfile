# Используем официальный образ Node.js
FROM node:18-alpine

# Создаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./
COPY prisma ./prisma/

# Устанавливаем зависимости
RUN npm ci

# Генерируем клиент Prisma
RUN npx prisma generate

# Копируем исходный код
COPY . .

# Команда для запуска приложения (миграции накатятся через docker-compose или скрипт)
CMD ["npm", "start"]
