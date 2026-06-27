import "dotenv/config";
import { Telegraf } from "telegraf";

// Импорты модулей
import { analyzeMessageWithLangChain } from "./modules/aiService.js";
import {
  analyzeDispatcherMessage,
  analyzeResolutionMessage,
} from "./utils/nlpParser.js";
import {
  createIncident,
  findRelevantIncident,
  resolveIncident,
} from "./modules/dbModules.js";
import { generateReply } from "./modules/responder.js";

// Проверка переменных окружения
if (!process.env.BOT_TOKEN) {
  throw new Error("❌ Не найден BOT_TOKEN в файле .env!");
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// --------------------------------------------------------
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ПАССАЖИРОВ
// --------------------------------------------------------
async function handlePassengerQuery(ctx, text) {
  try {
    await ctx.sendChatAction("typing");
    const parsedData = await analyzeMessageWithLangChain(text);

    if (!parsedData || !parsedData.isDelayQuestion) {
      return ctx.reply("👋 Здравствуйте! Я диспетчерский бот. Спросите меня: «Где 12 троллейбус?»", {
        reply_to_message_id: ctx.message.message_id
      });
    }

    // УМНЫЙ ПОИСК: если тип не определен, но есть маршрут — ищем широко
    let incidents = [];
    if (parsedData.transportType) {
      incidents = await findRelevantIncident(parsedData);
    } else if (parsedData.routes && parsedData.routes.length > 0) {
      incidents = await findRelevantIncident({ ...parsedData, transportType: null });
    }

    if (incidents.length === 0) {
      return ctx.reply("ℹ️ Активных инцидентов по вашему запросу не найдено.", {
        reply_to_message_id: ctx.message.message_id
      });
    }

    // Проверка на неоднозначность (если нашли разные типы транспорта)
    const uniqueTypes = [...new Set(incidents.map(i => i.transportType))];
    if (uniqueTypes.length > 1 && !parsedData.transportType) {
      return ctx.reply("🤔 Я нашел данные по этому маршруту и для трамваев, и для троллейбусов. Уточните, пожалуйста, что именно вас интересует?", {
        reply_to_message_id: ctx.message.message_id
      });
    }

    const replyText = generateReply(incidents, parsedData);
    await ctx.reply(replyText, { reply_to_message_id: ctx.message.message_id });
  } catch (err) {
    console.error("Ошибка обработки пассажира:", err);
    await ctx.reply("Извините, сервис временно недоступен.");
  }
}

// --------------------------------------------------------
// ОСНОВНОЙ ОБРАБОТЧИК (Только триггеры и сообщения)
// --------------------------------------------------------
bot.on("text", async (ctx) => {
  const text = ctx.message.text;
  // Команды игнорируем, если они вдруг прилетят (хотя мы их удалили)
  if (text.startsWith("/")) return; 

  const chatID = ctx.chat.id.toString();
  const lowerText = text.toLowerCase();
  
  // 1. ЛОГИКА ДЛЯ ДИСПЕТЧЕРОВ (ГРУППА)
  if (process.env.DISPATCH_GROUP_ID && chatID === process.env.DISPATCH_GROUP_ID) {
    // #инцидент
    if (lowerText.includes("#инцидент")) {
      try {
        const parsedData = await analyzeDispatcherMessage(text);
        if (!parsedData) return ctx.reply("❌ Не удалось распознать инцидент.");
        const result = await createIncident(parsedData);
        if (result) await ctx.reply(`✅ Инцидент ID ${result.incident.id} зафиксирован.`);
      } catch (err) { console.error("Ошибка создания:", err); }
      return;
    }
    // #закрыто
    if (lowerText.includes("#закрыто")) {
      try {
        const parsedData = await analyzeResolutionMessage(text);
        if (!parsedData) return ctx.reply("❌ Не удалось распознать данные для закрытия.");
        const result = await resolveIncident(parsedData);
        if (result && result.count > 0) {
          await ctx.reply(`✅ Движение восстановлено! Закрыто заявок: ${result.count}.`);
        } else {
          await ctx.reply(`⚠️ Активных инцидентов для закрытия не найдено.`);
        }
      } catch (err) { console.error("Ошибка закрытия:", err); }
      return;
    }
    return; 
  }

  // 2. ГРУППА ПАССАЖИРОВ (ответ только при упоминании)
  if (process.env.PASSENGER_GROUP_ID && chatID === process.env.PASSENGER_GROUP_ID) {
    const isBotMentioned = ctx.message.entities?.some(e => e.type === 'mention' || e.type === 'text_mention') 
                            || text.toLowerCase().includes("@" + ctx.botInfo.username.toLowerCase());
    if (isBotMentioned) await handlePassengerQuery(ctx, text);
    return;
  }

  // 3. ЛИЧКА
  if (ctx.chat.type === "private") {
    await handlePassengerQuery(ctx, text);
  }
});

// --------------------------------------------------------
// ЗАПУСК
// --------------------------------------------------------
console.log("⏳ Подключение к серверам Telegram...");
bot.telegram.getMe().then((botInfo) => {
    console.log(`✅ Бот @${botInfo.username} запущен.`);
    return bot.launch({ dropPendingUpdates: true });
}).catch((err) => { console.error("❌ Критическая ошибка:", err.message); process.exit(1); });

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));