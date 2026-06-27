import { GigaChat } from "langchain-gigachat/chat_models";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import "dotenv/config";
import https from "https";
import { gigaAuth } from "../services/gigachat.js"; // Ваш мост авторизации

// Настройка безопасности (без отключения глобальных флагов)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // В будущем замените на { ca: fs.readFileSync(...) }
});

// Определение схемы: route теперь явно может быть null
const parser = StructuredOutputParser.fromZodSchema(
  z.object({
    route: z
      .string()
      .nullable()
      .describe("Номер маршрута или null, если не указан"),
    transportType: z
      .enum(["tram", "trolleybus", "bus"])
      .nullable()
      .describe("Тип транспорта"),
    isDelayQuestion: z
      .boolean()
      .describe("Вопрос связан с задержкой транспорта?"),
  }),
);

// Создание шаблона запроса с инструкцией для гибкого поиска
const prompt = ChatPromptTemplate.fromMessages([
  [
    "system", 
    `Ты — помощник транспортного бота. Твоя задача — извлекать данные из сообщений.
    1. Если пользователь НЕ называет номер маршрута — обязательно установи route: null. 
    2. КРИТИЧЕСКИ ВАЖНО: Значение поля transportType должно быть СТРОГО на английском языке. Разрешены ТОЛЬКО варианты: "tram", "trolleybus", "bus". Никогда не пиши русские слова (например, "троллейбус" или "tроллейбус")!`
  ],
  ["human", "{format_instructions}\nСообщение пользователя: {message}"],
]);

// Функция анализа сообщения
export async function analyzeMessageWithLangChain(message) {
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
