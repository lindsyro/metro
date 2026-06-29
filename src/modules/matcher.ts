import { prisma } from "../db/prisma.js";

/**
 * Ищет активный инцидент в базе на основе данных от пассажира
 * @param {Object} passengerData { route, transportType, location }
 */
export async function findRelevantIncident(passengerData) {
  const { route, transportType } = passengerData;

  try {
    // Базовые условия поиска
    const whereClause = { status: "active" };

    // Если пассажир указал маршрут (например, "5")
    if (route) {
      // Ищем инцидент, где в массиве routes ЕСТЬ этот маршрут
      whereClause.routes = { has: route };
    }
    // Если маршрут не указан, но указан тип транспорта ("Где трамвай?")
    else if (transportType) {
      whereClause.transportType = transportType;
    }

    // Выполняем поиск через Prisma
    const incident = await prisma.incident.findFirst({
      where: whereClause,
      orderBy: { createdAt: "desc" }, // Берем самую свежую заявку
    });

    return incident; // Вернет объект инцидента или null
  } catch (error) {
    console.error("Ошибка при поиске в БД (Prisma):", error);
    return null;
  }
}
