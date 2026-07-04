# Используем свежий образ Node.js
FROM node:20-alpine

# Создаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./
COPY prisma ./prisma/

# Устанавливаем ВСЕ зависимости (включая devDependencies, так как там находится tsx)
RUN npm ci --legacy-peer-deps && npm install undici@6 --legacy-peer-deps

# Генерируем клиент Prisma
RUN npx prisma generate

# Копируем весь исходный код проекта
COPY . .

# Команда для запуска приложения (запустится через tsx, как прописано в package.json)
CMD ["npm", "start"]
