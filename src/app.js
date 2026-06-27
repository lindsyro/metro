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
// КОМАНДЫ (Ручное управление)
// --------------------------------------------------------

bot.command("dispatch", async (ctx) => {
  const text = ctx.message.text.replace("/dispatch", "").trim();
  if (!text) return ctx.reply("❌ Напишите текст заявки после команды /dispatch");

  ctx.reply("⏳ Анализирую заявку...");
  const parsedData = await analyzeDispatcherMessage(text);
  if (!parsedData) return ctx.reply("❌ Ошибка анализа заявки.");

  const result = await createIncident(parsedData);
  if (result) {
    ctx.reply(result.isNew ? `✅ Новая заявка ID: ${result.incident.id}.` : `ℹ️ Инцидент (ID: ${result.incident.id}) обновлен.`);
  } else {
    ctx.reply("❌ Ошибка базы данных.");
  }
});

bot.command("resolve", async (ctx) => {
  const text = ctx.message.text.replace("/resolve", "").trim();
  if (!text) return ctx.reply("❌ Напишите текст восстановления движения.");

  ctx.reply("⏳ Обрабатываю закрытие...");
  const parsedData = await analyzeResolutionMessage(text);
  if (!parsedData) return ctx.reply("❌ Ошибка анализа.");

  const result = await resolveIncident(parsedData);
  if (result && result.count > 0) {
    ctx.reply(`✅ Движение восстановлено! Закрыто активных заявок: ${result.count}.`);
  } else {
    ctx.reply(`ℹ️ Активных заявок по этим параметрам не найдено.`);
  }
});

// --------------------------------------------------------
// ОСНОВНОЙ ОБРАБОТЧИК (Текст и Группа)
// --------------------------------------------------------

bot.on("text", async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith("/")) return; // Игнорируем команды

  const lowerText = text.toLowerCase();
  const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup";
  const isDispatchGroup = process.env.DISPATCH_GROUP_ID && ctx.chat.id.toString() === process.env.DISPATCH_GROUP_ID;

  // 1. ЛОГИКА ДЛЯ ДИСПЕТЧЕРОВ (ГРУППА)
  if (isGroup && isDispatchGroup) {
    // Триггер создания
    if (lowerText.includes("#инцидент")) {
      try {
        const parsedData = await analyzeDispatcherMessage(text);
        if (!parsedData) return ctx.reply("❌ Не удалось распознать инцидент.");
        
        const result = await createIncident(parsedData);
        if (result) await ctx.reply(`✅ Инцидент ID ${result.incident.id} зафиксирован автоматически.`);
      } catch (err) {
        console.error("Ошибка создания:", err);
      }
      return;
    }

    // Триггер закрытия
    if (lowerText.includes("#закрыто")) {
      try {
        const parsedData = await analyzeResolutionMessage(text);
        if (!parsedData) return ctx.reply("❌ Не удалось распознать данные для закрытия.");
        
        const result = await resolveIncident(parsedData);
        if (result && result.count > 0) {
          await ctx.reply(`✅ Движение восстановлено! Закрыто заявок: ${result.count}.`);
        } else {
          await ctx.reply(`⚠️ Не удалось найти активный инцидент для закрытия.`);
        }
      } catch (err) {
        console.error("Ошибка закрытия:", err);
      }
      return;
    }
    return; // Остальные сообщения в группе игнорируем
  }

  // 2. ЛОГИКА ДЛЯ ПАССАЖИРОВ (ЛИЧКА)
  if (ctx.chat.type === "private") {
    try {
      await ctx.sendChatAction("typing");
      const parsedData = await analyzeMessageWithLangChain(text);

      if (!parsedData || !parsedData.isDelayQuestion) {
        return ctx.reply("👋 Здравствуйте! Я диспетчерский бот. \n\nЯ могу подсказать информацию об авариях и задержках на линии. \n\nСпросите меня, например: «Где 12 троллейбус?»");
      }

      if (!parsedData.transportType) {
        return ctx.reply("ℹ️ Я владею информацией только о трамваях, троллейбусах и метрополитене.");
      }

      const activeIncidents = await findRelevantIncident(parsedData);
      const replyText = generateReply(activeIncidents, parsedData);
      await ctx.reply(replyText, { reply_to_message_id: ctx.message.message_id });
    } catch (err) {
      console.error("Ошибка в ЛС:", err);
      await ctx.reply("Извините, сервис временно недоступен.");
    }
  }
});

// --------------------------------------------------------
// ЗАПУСК
// --------------------------------------------------------

console.log("⏳ Подключение к серверам Telegram...");
bot.telegram.getMe().then((botInfo) => {
    console.log(`✅ Бот @${botInfo.username} запущен.`);
    return bot.launch({ dropPendingUpdates: true });
}).catch((error) => {
    console.error("❌ Критическая ошибка:", error.message);
    process.exit(1);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));