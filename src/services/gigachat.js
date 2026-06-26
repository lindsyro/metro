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
  }

  async getToken() {
    // Если токен есть и до его протухания больше 2 минут (120 000 мс) — отдаем из кэша
    if (this.token && this.expiresAt && Date.now() < this.expiresAt - 120000) {
      console.log("GigaChat: токен существует, берем из кэша");
      return this.token;
    }

    const url = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";

    try {
      const response = await axios.post(url, "scope=GIGACHAT_API_PERS", {
        headers: {
          Authorization: `Basic ${this.authKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          RqUID: crypto.randomUUID(),
        },
        httpsAgent, // Используем общий агент
      });

      this.token = response.data.access_token;
      this.expiresAt = response.data.expires_at;

      console.log("GigaChat: запрошен новый токен авторизации");

      return this.token;
    } catch (error) {
      throw new Error(
        `Ошибка получения токена: ${error.response?.data?.message || error.message}`
      );
    }
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
      }
    );

    let text = response.data.choices[0].message.content;

    // Очищаем от markdown-разметки, если модель решила ее добавить
    text = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(text);
  } catch (error) {
    console.error("Ошибка при обращении к GigaChat:", error.message);
    return null;
  }
}