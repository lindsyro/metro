import type { Context } from "telegraf";
import { analyzeMessageWithLangChain } from "../modules/aiService.js";
import { findRelevantIncident } from "../modules/dbModules.js";
import { generateReply } from "../modules/responder.js";

/**
 * Обработка запроса пассажира о задержке транспорта.
 * Анализирует текст через GigaChat, ищет активные инциденты и формирует ответ.
 */
export async function handlePassengerQuery(ctx: Context, text: string): Promise<void> {
  try {
    await ctx.sendChatAction("typing");
    const parsedData = await analyzeMessageWithLangChain(text);

    // if (!parsedData || !parsedData.isDelayQuestion) {
    //   await ctx.reply(
    //     "👋 Здравствуйте! Я диспетчерский бот. Спросите меня: «Где 12 троллейбус?»",
    //     {
    //       reply_to_message_id: ctx.message!.message_id,
    //     },
    //   );
    //   return;
    // }

    // УМНЫЙ ПОИСК: если тип не определен, но есть маршрут — ищем широко
    let incidents: any[] = [];
    if (parsedData.transportType) {
      incidents = await findRelevantIncident(parsedData);
    } else if (parsedData.routes && parsedData.routes.length > 0) {
      incidents = await findRelevantIncident({
        ...parsedData,
        transportType: null,
      });
    }

    if (incidents.length === 0) {
      await ctx.reply("ℹ️ Активных инцидентов по вашему запросу не найдено.", {
        reply_to_message_id: ctx.message!.message_id,
      });
      return;
    }

    // Проверка на неоднозначность (если нашли разные типы транспорта)
    const uniqueTypes = [
      ...new Set(incidents.map((i: any) => i.transportType)),
    ];
    if (uniqueTypes.length > 1 && !parsedData.transportType) {
      await ctx.reply(
        "🤔 Я нашел данные по этому маршруту и для трамваев, и для троллейбусов. Уточните, пожалуйста, что именно вас интересует?",
        {
          reply_to_message_id: ctx.message!.message_id,
        },
      );
      return;
    }

    const replyText = generateReply(incidents, parsedData);
    await ctx.reply(replyText, { reply_to_message_id: ctx.message!.message_id });
  } catch (err) {
    console.error("Ошибка обработки пассажира:", err);
    await ctx.reply("Извините, сервис временно недоступен.");
  }
}
