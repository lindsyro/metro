import { askGigaChat } from '../services/gigachat.js';

/**
 * Модуль 4.2: Анализирует сообщение пассажира
 */
export async function analyzePassengerMessage(text) {
  const prompt = `
    Ты — строгий анализатор данных транспортной компании. Твоя задача только возвращать JSON.
    Проанализируй сообщение пассажира: "${text}"
    
    Верни строго JSON-объект с ключами:
    "isDelayQuestion": true/false (спрашивает ли человек про задержку, ожидание или отсутствие транспорта)
    "transportType": "tram" (трамвай), "trolleybus" (троллейбус), "bus" (автобус) или null
    "route": номер маршрута строкой (например "5", "20А") или null
    "location": название остановки/улицы или null
    `;

  return await askGigaChat(prompt);
}

/**
 * Модуль 4.1: Анализирует сообщение диспетчера
 */
export async function analyzeDispatcherMessage(text) {
  const prompt = `
    Ты — строгий анализатор заявок. Твоя задача только возвращать JSON.
    Извлеки данные из сообщения диспетчера: "${text}"
    
    Верни строго JSON-объект с ключами:
    "incidentType": одно из ["обрыв_сети", "дтп", "поломка", "отключение_тока", "иная_причина"]. Считай любую "аварию" как "дтп".
    "routes": МАССИВ строк с номерами маршрутов (например ["4", "7"]). Если маршрутов нет, верни пустой массив [].
    "location": участок, перекресток, улица
    `;

  return await askGigaChat(prompt);
}