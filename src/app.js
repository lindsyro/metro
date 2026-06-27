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

// Проверка токена
if (!process.env.BOT_TOKEN) {
  throw new Error("❌ Не найден BOT_TOKEN в файле .env!");
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// --------------------------------------------------------
// СЦЕНАРИЙ 1: ДИСПЕТЧЕР (/dispatch)
// --------------------------------------------------------
bot.command("dispatch", async (ctx) => {
  const text = ctx.message.text.replace("/dispatch", "").trim();
  if (!text)
    return ctx.reply("❌ Напишите текст заявки после команды /dispatch");

  ctx.reply("⏳ Анализирую заявку диспетчера...");
  const parsedData = await analyzeDispatcherMessage(text);

  if (!parsedData) return ctx.reply("❌ Ошибка анализа заявки.");

  const result = await createIncident(parsedData);
  if (result) {
    const { incident, isNew } = result;
    ctx.reply(
      isNew
        ? `✅ Новая заявка ID: ${incident.id} зарегистрирована.`
        : `ℹ️ Инцидент (ID: ${incident.id}) обновлен.`,
    );
  } else {
    ctx.reply("❌ Ошибка при работе с базой данных.");
  }
});

// --------------------------------------------------------
// СЦЕНАРИЙ 2: УСТРАНЕНИЕ (/resolve)
// --------------------------------------------------------
bot.command("resolve", async (ctx) => {
  const text = ctx.message.text.replace("/resolve", "").trim();
  if (!text) return ctx.reply("❌ Напишите текст восстановления движения.");

  ctx.reply("⏳ Обрабатываю закрытие аварии...");
  const parsedData = await analyzeResolutionMessage(text);

  if (!parsedData) return ctx.reply("❌ Ошибка анализа текста.");

  const result = await resolveIncident(parsedData);
  if (result && result.count > 0) {
    ctx.reply(
      `✅ Движение восстановлено! Закрыто активных заявок: ${result.count}.`,
    );
  } else {
    ctx.reply(`ℹ️ Активных заявок по данным параметрам не найдено.`);
  }
});

// --------------------------------------------------------
// СЦЕНАРИЙ 3: ПАССАЖИР (Интеллектуальный анализ через GigaChat)
// --------------------------------------------------------
bot.on("text", async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith("/")) return; // Игнорируем команды

  try {
    // Используем обновленный сервис LangChain
    const parsedData = await analyzeMessageWithLangChain(text);

    // Если ответ пустой или это обычная болтовня (не вопрос о задержке)
    if (!parsedData || !parsedData.isDelayQuestion) return;

    console.log("🤖 GigaChat распознал запрос:", parsedData);

    // Ищем инциденты в базе по распознанному маршруту/типу
    const activeIncidents = await findRelevantIncident(parsedData);

    // Формируем красивый ответ через ваш responder
    const replyText = generateReply(activeIncidents, parsedData);

    await ctx.reply(replyText, {
      reply_to_message_id: ctx.message.message_id,
    });
  } catch (err) {
    console.error("❌ Ошибка в обработке сообщения:", err);
    // Можно не отвечать пользователю, если ошибка, чтобы не спамить в чат
  }
});

// Запуск бота
console.log("⏳ Подключение к серверам Telegram...");

// 1. Сначала проверяем соединение и валидность токена
bot.telegram
  .getMe()
  .then((botInfo) => {
    // Этот код выполнится ТОЛЬКО если токен верный и интернет работает
    console.log("=======================================");
    console.log(
      `✅ УСПЕХ: Связь установлена! Бот @${botInfo.username} готов к работе.`,
    );
    console.log("=======================================");

    // 2. Только теперь запускаем получение сообщений
    return bot.launch({ dropPendingUpdates: true });
  })
  .catch((error) => {
    // Сюда попадем, если нет интернета или токен неверный
    console.error(
      "❌ Критическая ошибка при подключении к Telegram:",
      error.message,
    );
    process.exit(1); // Завершаем программу с кодом ошибки
  });

// Безопасная плавная остановка
const safeStop = (signal) => {
  try {
    bot.stop(signal);
    console.log(`\n🛑 Бот остановлен (${signal})`);
  } catch (err) {
    console.log(`\n🛑 Процесс завершен (${signal})`);
    process.exit(0);
  }
};

process.once("SIGINT", () => safeStop("SIGINT"));
process.once("SIGTERM", () => safeStop("SIGTERM"));
