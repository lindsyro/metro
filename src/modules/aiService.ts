import { GigaChat } from "langchain-gigachat/chat_models";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import "dotenv/config";
import https from "https";
import { gigaAuth } from "../services/gigachat.js";

// Определение схемы: добавили location и заменили route на массив routes
const parser = StructuredOutputParser.fromZodSchema(
  z.object({
    routes: z
      .array(z.string())
      .describe(
        "Массив номеров маршрутов/линий. Сюда писать ТОЛЬКО ЦИФРЫ. Если маршрут не указан, верни пустой массив []",
      ),
    location: z
      .string()
      .nullable()
      .describe(
        "Улица, остановка или район (например, 'Ленина', 'Баумана'). Если не указано, верни null",
      ),
    transportType: z
      .enum(["tram", "trolleybus", "metro"])
      .nullable()
      .describe("Тип транспорта (трамвай, троллейбус или метро)"),
    isDelayQuestion: z
      .boolean()
      .describe("Вопрос связан с задержкой транспорта?"),
  }),
);

// Создание шаблона запроса с обновленными инструкциями про улицы и цифры
const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `Ты — помощник транспортного бота. Твоя задача — извлекать данные из сообщений.
    1. Если пользователь называет улицу, район или остановку (например, "на Ленина", "Баумана", "в центре") — ОБЯЗАТЕЛЬНО пиши это в поле "location".
    2. Поле "routes" должно содержать ТОЛЬКО номера (цифры). Никогда не пиши туда названия улиц! Если номеров в сообщении нет, верни пустой массив [].
    3. КРИТИЧЕСКИ ВАЖНО: Значение поля transportType должно быть СТРОГО на английском языке. Разрешены ТОЛЬКО варианты: "tram", "trolleybus", "metro". Никогда не пиши русские слова! Если спрашивают про автобусы или другой транспорт, устанавливай transportType: null.
    4. Считай ЛЮБЫЕ вопросы ИЛИ ЖАЛОБЫ на ожидание, местоположение, поломки или отсутствие транспорта ("где", "когда будет", "почему стоит", "не могу уехать", "нет троллейбуса уже долго") как запросы о задержке (устанавливай isDelayQuestion: true).`,
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
      temperature: 0, // 0 нужен для строгого соблюдения JSON-схемы
    });

    const chain = prompt.pipe(model).pipe(parser);

    console.log(`[GigaChat] 🤖 Отправляем на анализ сообщение пассажира: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);

    // 3. Выполняем запрос
    const result = await chain.invoke({
      format_instructions: parser.getFormatInstructions(),
      message,
    });

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ Ошибка в AI сервисе (LangChain):", message);
    return null;
  }
}
