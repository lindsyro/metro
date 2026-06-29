import { prisma } from "../db/prisma.js";

/**
 * Сохраняет новую заявку от диспетчера в базу данных
 * @param {Object} dispatcherData Данные, полученные от GigaChat
 */
export async function createIncident(dispatcherData) {
  try {
    const newIncident = await prisma.incident.create({
      data: {
        incidentType: dispatcherData.incidentType,
        // Если GigaChat вернул массив, сохраняем его, иначе пустой массив
        routes: Array.isArray(dispatcherData.routes)
          ? dispatcherData.routes
          : [],
        location: dispatcherData.location,
        // transportType можно определять по маршруту или контексту, пока оставим null или выведем из GigaChat
      },
    });

    console.log(`✅ Инцидент #${newIncident.id} успешно сохранен в базу.`);
    return newIncident;
  } catch (error) {
    console.error("Ошибка при сохранении инцидента:", error);
    return null;
  }
}
