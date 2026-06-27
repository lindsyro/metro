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
// --------------------------------------------------------
// СЦЕНАРИЙ 3: ПАССАЖИР (Интеллектуальный анализ через GigaChat)
// --------------------------------------------------------
bot.on("text", async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith("/")) return; // Игнорируем команды

  try {
    // Отправляем индикатор набора текста (улучшает UX)
    await ctx.sendChatAction("typing");

    // Анализируем текст через GigaChat
    const parsedData = await analyzeMessageWithLangChain(text);

    // 1. Если это вообще не про задержку/транспорт
    if (!parsedData || !parsedData.isDelayQuestion) {
      return ctx.reply(
        "👋 Здравствуйте! Я — диспетчерский бот. \n\nЯ могу подсказать информацию об авариях и задержках на линии. К сожалению, на другие темы я общаться не умею.\n\nСпросите меня, например: \n«Где 12 троллейбус?» или «Почему не ходят трамваи?»",
        { reply_to_message_id: ctx.message.message_id },
      );
    }

    // 2. НОВАЯ ПРОВЕРКА: Если спросили про автобусы (transportType остался null)
    if (!parsedData.transportType) {
      return ctx.reply(
        "ℹ️ Я диспетчер МУП «Метроэлектротранс». Я владею информацией только о трамваях, троллейбусах и метрополитене. По вопросам работы автобусов, пожалуйста, обращайтесь в профильные ПАТП.",
        { reply_to_message_id: ctx.message.message_id },
      );
    }

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
    // Добавим ответ и на случай падения API (чтобы бот не молчал при ошибках)
    await ctx.reply("Извините, сервис временно недоступен. Мы уже чиним! 🛠");
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
