import { GigaChat } from "langchain-gigachat/chat_models";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import "dotenv/config";
import https from "https";
import { gigaAuth } from "../services/gigachat.js";

// Настройка безопасности (без отключения глобальных флагов)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // В будущем замените на { ca: fs.readFileSync(...) }
});

// Определение схемы: добавили metro
const parser = StructuredOutputParser.fromZodSchema(
  z.object({
    route: z
      .string()
      .nullable()
      .describe("Номер маршрута/линии или null, если не указан"),
    transportType: z
      .enum(["tram", "trolleybus", "metro"])
      .nullable()
      .describe("Тип транспорта (трамвай, троллейбус или метро)"),
    isDelayQuestion: z
      .boolean()
      .describe("Вопрос связан с задержкой транспорта?"),
  }),
);

// Создание шаблона запроса с обновленными инструкциями
const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `Ты — помощник транспортного бота. Твоя задача — извлекать данные из сообщений.
    1. Если пользователь НЕ называет номер маршрута или линии — обязательно установи route: null. 
    2. КРИТИЧЕСКИ ВАЖНО: Значение поля transportType должно быть СТРОГО на английском языке. Разрешены ТОЛЬКО варианты: "tram", "trolleybus", "metro". Никогда не пиши русские слова! Если спрашивают про автобусы или другой транспорт, устанавливай transportType: null.
    3. Считай ЛЮБЫЕ вопросы ИЛИ ЖАЛОБЫ на ожидание, местоположение, поломки или отсутствие транспорта ("где", "когда будет", "почему стоит", "жду", "нет троллейбуса уже долго") как запросы о задержке (устанавливай isDelayQuestion: true).`,
  ],
  ["human", "{format_instructions}\nСообщение пользователя: {message}"],
]);

// Функция анализа сообщения
export async function analyzeMessageWithLangChain(message: string) {
  try {
    // 1. Получаем свежий токен через ваш мост
    const token = await gigaAuth.getToken();

    // 2. Инициализируем модель с токеном
    const model = new GigaChat({
      accessToken: token,
      model: "GigaChat",
      temperature: 0,
      httpsAgent: httpsAgent,
    });

    const chain = prompt.pipe(model).pipe(parser);

    // 3. Выполняем запрос
    const result = await chain.invoke({
      format_instructions: parser.getFormatInstructions(),
      message,
    });

    // Дополнительная нормализация: если маршрут пришел пустой строкой, приводим к null
    if (result.route === "") result.route = null;

    return result;
  } catch (err) {
    console.error("❌ Ошибка в AI сервисе (LangChain):", err.message || err);
    return null;
  }
}
