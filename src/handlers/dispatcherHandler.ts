import type { Context, Telegraf } from "telegraf";
import {
  analyzeDispatcherMessage,
  analyzeResolutionMessage,
} from "../utils/nlpParser.js";
import { createIncident, resolveIncident } from "../modules/dbModules.js";

// Временное хранилище для заявок без указанного типа транспорта
const draftIncidents = new Map<string, any>();

/**
 * Вспомогательная функция для сохранения инцидента и ответа диспетчеру
 */
async function processAndSaveIncident(ctx: Context, data: any): Promise<void> {
  try {
    const result = await createIncident(data);
    if (result) {
      // Проверяем, новая это запись или обновление существующей
      if (result.isNew) {
        await ctx.reply(`✅ Инцидент ID ${result.incident.id} зафиксирован.`);
      } else {
        await ctx.reply(
          `ℹ️ Инцидент ID ${result.incident.id} уже был зафиксирован.`,
        );
      }
    } else {
      await ctx.reply("❌ Ошибка при сохранении в базу данных.");
    }
  } catch (err) {
    console.error("Ошибка сохранения инцидента:", err);
  }
}

/**
 * Обработка команды #инцидент от диспетчера
 */
async function handleNewIncident(ctx: Context, text: string): Promise<void> {
  try {
    const parsedData = await analyzeDispatcherMessage(text);
    if (!parsedData) {
      await ctx.reply("❌ Не удалось распознать инцидент.");
      return;
    }

    // --- УМНАЯ ПРОВЕРКА ПОЛНОТЫ ДАННЫХ ---
    if (
      parsedData.routes &&
      parsedData.routes.length > 0 &&
      !parsedData.transportType
    ) {
      const draftId = Date.now().toString();
      draftIncidents.set(draftId, parsedData);

      await ctx.reply(
        `⚠️ Для маршрута №${parsedData.routes.join(", ")} не указан вид транспорта. Уточните:`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🚋 Трамвай",
                  callback_data: `set_type_${draftId}_tram`,
                },
                {
                  text: "🚎 Троллейбус",
                  callback_data: `set_type_${draftId}_trolleybus`,
                },
              ],
              [
                {
                  text: "❌ Отменить",
                  callback_data: `cancel_draft_${draftId}`,
                },
              ],
            ],
          },
          reply_to_message_id: ctx.message?.message_id,
        },
      );
      return;
    }

    // Если всё заполнено сразу, сохраняем штатно
    await processAndSaveIncident(ctx, parsedData);
  } catch (err) {
    console.error("Ошибка создания инцидента:", err);
  }
}

/**
 * Обработка команды #закрыто от диспетчера
 */
async function handleResolveIncident(
  ctx: Context,
  text: string,
): Promise<void> {
  try {
    const parsedData = await analyzeResolutionMessage(text);
    if (!parsedData) {
      await ctx.reply("❌ Не удалось распознать данные для закрытия.");
      return;
    }
    const result = await resolveIncident(parsedData);
    if (result && result.count > 0) {
      await ctx.reply(
        `✅ Движение восстановлено! Закрыто заявок: ${result.count}.`,
      );
    } else {
      await ctx.reply(`⚠️ Активных инцидентов для закрытия не найдено.`);
    }
  } catch (err) {
    console.error("Ошибка закрытия инцидента:", err);
  }
}

/**
 * Главный обработчик сообщений из группы диспетчеров.
 * Распознаёт хештеги #инцидент и #закрыто.
 */
export async function handleDispatcherMessage(
  ctx: Context,
  text: string,
): Promise<void> {
  const lowerText = text.toLowerCase();

  if (lowerText.includes("#инцидент")) {
    await handleNewIncident(ctx, text);
    return;
  }

  if (lowerText.includes("#закрыто")) {
    await handleResolveIncident(ctx, text);
    return;
  }
}

/**
 * ЭКСПОРТ ОБРАБОТЧИКОВ КНОПОК:
 * Вызовите эту функцию один раз в app.ts, передав в нее экземпляр бота
 */
export function setupDispatcherActions(bot: Telegraf<Context>) {
  // Обработка выбора типа транспорта
  bot.action(/^set_type_(.+?)_(.+)$/, async (ctx) => {
    // В Telegraf ctx.match содержит группы из регулярного выражения
    const match = (ctx as any).match;
    if (!match) return;

    const draftId = match[1];
    const transportType = match[2];

    const draftData = draftIncidents.get(draftId);
    if (!draftData) {
      await ctx.answerCbQuery("❌ Заявка устарела или уже обработана.", {
        show_alert: true,
      });
      return;
    }

    // Обновляем данные и чистим память
    draftData.transportType = transportType;
    draftIncidents.delete(draftId);

    const typeName = transportType === "tram" ? "Трамвай" : "Троллейбус";
    await ctx.editMessageText(
      `✅ Выбран вид транспорта: ${typeName}. Сохраняю...`,
    );

    // Передаем дополненные данные на сохранение
    await processAndSaveIncident(ctx, draftData);
    await ctx.answerCbQuery();
  });

  // Обработка отмены
  bot.action(/^cancel_draft_(.+)$/, async (ctx) => {
    const match = (ctx as any).match;
    if (!match) return;

    const draftId = match[1];
    draftIncidents.delete(draftId);

    await ctx.editMessageText("❌ Создание заявки отменено диспетчером.");
    await ctx.answerCbQuery();
  });
}
