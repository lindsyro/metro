import type { Context } from "telegraf";
import {
  analyzeDispatcherMessage,
  analyzeResolutionMessage,
} from "../utils/nlpParser.js";
import { createIncident, resolveIncident } from "../modules/dbModules.js";

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
    const result = await createIncident(parsedData);
    if (result) {
      await ctx.reply(`✅ Инцидент ID ${result.incident.id} зафиксирован.`);
    }
  } catch (err) {
    console.error("Ошибка создания инцидента:", err);
  }
}

/**
 * Обработка команды #закрыто от диспетчера
 */
async function handleResolveIncident(ctx: Context, text: string): Promise<void> {
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
export async function handleDispatcherMessage(ctx: Context, text: string): Promise<void> {
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
