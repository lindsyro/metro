import type { Context } from "telegraf";
import { analyzeMessageWithLangChain } from "../modules/aiService.js";
import { findRelevantIncident } from "../modules/dbModules.js";
import { generateReply } from "../modules/responder.js";

/**
 * Обработка запроса пассажира о задержке транспорта.
 * Анализирует текст через GigaChat, ищет активные инциденты и формирует ответ.
 */
export async function handlePassengerQuery(
  ctx: Context,
  text: string,
): Promise<void> {
  try {
    const lowerText = text.toLowerCase();
    if (lowerText.includes("автобус") || lowerText.includes("маршрутк")) {
      await ctx.reply(
        "ℹ️ Внимание: предоставляется информация исключительно о нештатных ситуациях на линиях электрического транспорта: трамваев, троллейбусов и метрополитена. Сведения об автобусах и маршрутных такси не обрабатываются. ",
        { reply_to_message_id: ctx.message!.message_id },
      );
      return; // Прерываем функцию, нейросеть даже не запускается
    }

    await ctx.sendChatAction("typing");
    const parsedData = await analyzeMessageWithLangChain(text);

    // 1. УМНЫЙ ФИЛЬТР: Если GigaChat определил, что это обычное сообщение (не жалоба/вопрос),
    // бот просто молча выходит из функции и ничего не отвечает.
    if (!parsedData || !parsedData.isDelayQuestion) {
      return;
    }

    // Если нет ни типа транспорта, ни маршрута - это ложное срабатывание (например, "жду обед")
    if (!parsedData.transportType && !parsedData.route) {
      return;
    }

    // Приводим route к массиву routes для совместимости с findRelevantIncident
    if (parsedData.route) {
      parsedData.routes = [parsedData.route];
    }


    // 2. УМНЫЙ ПОИСК: если тип не определен, но есть маршрут — ищем широко
    let incidents: any[] = [];
    if (parsedData.transportType) {
      incidents = await findRelevantIncident(parsedData);
    } else if (parsedData.routes && parsedData.routes.length > 0) {
      incidents = await findRelevantIncident({
        ...parsedData,
        transportType: null,
      });
    }

    // 3. Проверка на неоднозначность (если нашли разные типы транспорта для одного номера)
    if (incidents.length > 0) {
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
    }

    // 4. Формируем ответ через responder.
    // Если incidents пуст, responder сам выдаст зеленую галочку "сбоев не зафиксировано"
    const replyText = generateReply(incidents, parsedData);
    await ctx.reply(replyText, {
      reply_to_message_id: ctx.message!.message_id,
    });
  } catch (err) {
    console.error("Ошибка обработки пассажира:", err);
    // В публичном чате лучше не писать "сервис недоступен" при сбое ИИ, чтобы не привлекать внимание
  }
}
