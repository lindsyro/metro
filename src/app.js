// import 'dotenv/config';
// import { analyzePassengerMessage, analyzeDispatcherMessage } from "./utils/nlpParser.js";

// async function start() {
//     console.log("Ждем ответа от GigaChat...");

//     const passResult = await analyzePassengerMessage("Что-то 5-го трамика долго нет на Пушкина, замерз уже");
//     console.log("Результат пассажира:", passResult);

//     const dispResult = await analyzeDispatcherMessage("Авария на путях, Ленина 15, встали 4 и 7 маршруты");
//     console.log("Результат диспетчера:", dispResult);
// }

// start();

import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { analyzePassengerMessage, analyzeDispatcherMessage } from './utils/nlpParser.js';
import { createIncident, findRelevantIncident } from './modules/dbModules.js';
import { generateReply } from './modules/responder.js';

// Проверка токена
if (!process.env.BOT_TOKEN) {
    throw new Error("Не найден BOT_TOKEN в файле .env!");
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// --------------------------------------------------------
// СЦЕНАРИЙ 1: ДИСПЕТЧЕР (Команда /dispatch)
// Чтобы бот не путал пассажиров и диспетчеров, пусть диспетчер пишет команду:
// Пример: /dispatch Авария на путях, Ленина 15, встали 4 и 7 маршруты
// --------------------------------------------------------
bot.command('dispatch', async (ctx) => {
    // Убираем само слово "/dispatch " из текста
    const text = ctx.message.text.replace('/dispatch', '').trim();
    if (!text) return ctx.reply("❌ Напишите текст заявки после команды /dispatch");

    ctx.reply("⏳ Анализирую заявку диспетчера...");

    const parsedData = await analyzeDispatcherMessage(text);
    if (!parsedData) return ctx.reply("❌ Ошибка анализа текста (GigaChat).");

    const incident = await createIncident(parsedData);
    if (incident) {
        ctx.reply(`✅ Заявка зарегистрирована в базе!\nТип: ${incident.incidentType}\nМаршруты: ${incident.routes.join(', ')}`);
    } else {
        ctx.reply("❌ Ошибка при сохранении в базу данных.");
    }
});

// --------------------------------------------------------
// СЦЕНАРИЙ 2: ПАССАЖИР (Любой обычный текст в чате)
// --------------------------------------------------------
bot.on('text', async (ctx) => {
    const text = ctx.message.text;

    // Игнорируем команды (начинаются с /)
    if (text.startsWith('/')) return;

    // 1. Анализируем сообщение (Модуль 4.2)
    const parsedData = await analyzePassengerMessage(text);
    
    // Если это не вопрос о задержке — бот просто молчит и ничего не делает
    if (!parsedData || !parsedData.isDelayQuestion) return;

    // 2. Ищем причину в базе (Модуль 4.3)
    const activeIncident = await findRelevantIncident(parsedData);

    // 3. Формируем и отправляем ответ (Модуль 4.4)
    const replyText = generateReply(activeIncident, parsedData);
    await ctx.reply(replyText, { reply_to_message_id: ctx.message.message_id });
});

// Запуск бота
bot.launch().then(() => {
    console.log("🤖 Транспортный бот успешно запущен!");
});

// Плавная остановка
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));