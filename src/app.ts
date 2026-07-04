import "dotenv/config";
import { Telegraf } from "telegraf";
import { ProxyAgent, fetch } from "undici";
import {
  handleDispatcherMessage,
  setupDispatcherActions,
} from "./handlers/dispatcherHandler.js";
import { handlePassengerQuery } from "./handlers/passengerHandler.js";

// Проверка переменных окружения
if (!process.env.BOT_TOKEN) {
  throw new Error("❌ Не найден BOT_TOKEN в файле .env!");
}

const agent = new ProxyAgent("http://proxy:18080");

const bot = new Telegraf(process.env.BOT_TOKEN, {
  telegram: {
    // Заставляем бота идти через прокси
    fetch: (url, config) => {
      return fetch(url, {
        ...config,
        dispatcher: agent,
      });
    },
  },
});

setupDispatcherActions(bot);
// --------------------------------------------------------
// МАРШРУТИЗАЦИЯ СООБЩЕНИЙ
// --------------------------------------------------------
bot.on("text", async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith("/")) return;

  const chatID = ctx.chat.id.toString();

  // 1. ГРУППА ДИСПЕТЧЕРОВ
  if (
    process.env.DISPATCH_GROUP_ID &&
    chatID === process.env.DISPATCH_GROUP_ID
  ) {
    await handleDispatcherMessage(ctx, text);
    return;
  }

  // 2. ГРУППА ПАССАЖИРОВ
  if (ctx.chat.type === "supergroup" || ctx.chat.type === "group") {
    await handlePassengerQuery(ctx, text);
    return;
  }

  // 3. ЛИЧНЫЕ СООБЩЕНИЯ
  if (ctx.chat.type === "private") {
    await handlePassengerQuery(ctx, text);
  }
});

// --------------------------------------------------------
// ЗАПУСК
// --------------------------------------------------------
console.log("⏳ Подключение к серверам Telegram...");
bot.telegram
  .getMe()
  .then((botInfo) => {
    console.log(`✅ Бот @${botInfo.username} запущен.`);
    return bot.launch({ dropPendingUpdates: true });
  })
  .catch((err: unknown) => {
    console.error("❌ Критическая ошибка (Full Object):", err);
    process.exit(1);
  });

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
