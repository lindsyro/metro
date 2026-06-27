import "dotenv/config";
import crypto from "crypto";
import axios from "axios";
import https from "https";

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

class GigaChatAuth {
  constructor() {
    this.authKey = process.env.CLIENT_SECRET;
    this.token = null;
    this.expiresAt = null;

    // Новое свойство: будет хранить текущий процесс получения токена
    this._tokenPromise = null;
  }

  async getToken() {
    // 1. Если токен есть и он живой — отдаем сразу
    if (this.token && this.expiresAt && Date.now() < this.expiresAt - 120000) {
      return this.token;
    }

    // 2. Если запрос за токеном УЖЕ идет прямо сейчас — ждем его, а не создаем новый!
    if (this._tokenPromise) {
      console.log("GigaChat: ожидание уже запущенного запроса токена...");
      return this._tokenPromise;
    }

    // 3. Запускаем новый запрос и сохраняем его в _tokenPromise
    this._tokenPromise = (async () => {
      const url = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";
      try {
        const response = await axios.post(url, "scope=GIGACHAT_API_PERS", {
          headers: {
            Authorization: `Basic ${this.authKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            RqUID: crypto.randomUUID(),
          },
          httpsAgent,
        });

        this.token = response.data.access_token;
        this.expiresAt = response.data.expires_at;

        console.log("GigaChat: запрошен новый токен авторизации");
        return this.token;
      } catch (error) {
        console.error(
          "Критическая ошибка получения токена:",
          error?.response?.data || error.message,
        );
        throw error;
      } finally {
        // Обязательно очищаем промис после завершения (даже если была ошибка)
        this._tokenPromise = null;
      }
    })();

    // Возвращаем результат выполнения
    return this._tokenPromise;
  }
}

export const gigaAuth = new GigaChatAuth();

/**
 * Вспомогательная функция: отправка промпта в GigaChat
 */
export async function askGigaChat(prompt) {
  // ИСПРАВЛЕНИЕ 1: Обращаемся к нашему классу для получения токена
  const token = await gigaAuth.getToken();

  try {
    const response = await axios.post(
      "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
      {
        model: "GigaChat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        httpsAgent,
      },
    );

    const responseText = response.data.choices[0].message.content;

    // --- НОВЫЙ БЛОК ОЧИСТКИ ОТ МУСОРА ---
    // Ищем первую { и последнюю } в ответе нейросети
    const firstBrace = responseText.indexOf("{");
    const lastBrace = responseText.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1) {
      const cleanJsonString = responseText.substring(firstBrace, lastBrace + 1);
      return JSON.parse(cleanJsonString);
    } else {
      // Если скобок нет, пытаемся распарсить как есть (на случай ошибки)
      return JSON.parse(responseText);
    }
    // ------------------------------------
  } catch (error) {
    console.error("Ошибка при обращении к GigaChat:", error.message);
    return null;
  }
}
