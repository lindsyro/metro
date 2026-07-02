import { prisma } from "../database/prisma.js";
import type { DispatcherData, PassengerData, ResolutionData } from "../types.js";

// --- ДЛЯ ДИСПЕТЧЕРА (Модуль 4.1) ---
export async function createIncident(data: DispatcherData) {
  try {
    const incomingRoutes = Array.isArray(data.routes) ? data.routes : [];

    console.log("🔍 [DEBUG] Проверяем на полный дубликат...");
    
    // Ищем АБСОЛЮТНО идентичный инцидент
    const existingIncident = await prisma.incident.findFirst({
      where: {
        status: "active",
        incidentType: data.incidentType || "иная причина",
        transportType: data.transportType || null,
        routes: { equals: incomingRoutes },
        location: data.location || null,
        direction: data.direction || null,
      },
    });

    if (existingIncident) {
      console.log(`✅ [DEBUG] ПОЛНЫЙ ДУБЛИКАТ НАЙДЕН (ID: ${existingIncident.id}). ПРОПУСКАЕМ СОЗДАНИЕ.`);
      return { incident: existingIncident, isNew: false };
    }

    console.log("⚠️ [DEBUG] Создаем НОВЫЙ инцидент.");
    const newIncident = await prisma.incident.create({
      data: {
        incidentType: data.incidentType || "иная_причина",
        transportType: data.transportType || null,
        routes: incomingRoutes,
        location: data.location || null,
        direction: data.direction || null,
      },
    });

    return { incident: newIncident, isNew: true };
  } catch (error) {
    console.error("❌ КРИТИЧЕСКАЯ ОШИБКА В DB:", error);
    return null;
  }
}

// --- ДЛЯ ПАССАЖИРА (Модуль 4.3) ---
export async function findRelevantIncident(parsedData: PassengerData) {
  try {
    const whereClause: any = { status: "active" };

    // Если есть маршруты — ищем по ним, если нет — ищем все активные
    if (parsedData.routes && parsedData.routes.length > 0) {
      whereClause.routes = { hasSome: parsedData.routes };
    }

    // Если в запросе указан тип транспорта (трамвай/автобус), уточняем поиск
    if (parsedData.transportType) {
      whereClause.transportType = parsedData.transportType;
    }

    if (parsedData.direction) {
      whereClause.direction = {
        contains: parsedData.direction,
        mode: "insensitive",
      };
    }

    return await prisma.incident.findMany({
      where: whereClause,
    });
  } catch (error) {
    console.error("Ошибка при поиске инцидента:", error);
    return [];
  }
}

// --- ДЛЯ ДИСПЕТЧЕРА: ЗАКРЫТИЕ ИНЦИДЕНТА (Модуль 4.6) ---
export async function resolveIncident(data: ResolutionData) {
  if ((!data.routes || data.routes.length === 0) && !data.location) {
    return { count: 0 };
  }

  try {
    // Формируем более строгие условия
    const orConditions: any[] = [];

    // Условие 1: Ищем по связке (Тип транспорта + Маршрут) - ЭТО САМОЕ ВАЖНОЕ
    if (data.transportType && data.routes && data.routes.length > 0) {
      orConditions.push({
        transportType: data.transportType,
        routes: { hasSome: data.routes },
      });
    } else if (data.routes && data.routes.length > 0) {
      // Если тип транспорта не определен, но есть маршрут - ищем только по маршруту (как раньше)
      orConditions.push({ routes: { hasSome: data.routes } });
    }

    // Условие 2: Ищем по локации
    if (data.location) {
      orConditions.push({
        location: { contains: data.location, mode: "insensitive" },
      });
    }

    const result = await prisma.incident.updateMany({
      where: {
        status: "active",
        // Убеждаемся, что если тип транспорта передан, он должен совпадать
        ...(data.transportType && { transportType: data.transportType }),
        OR: orConditions,
      },
      data: {
        status: "resolved",
        resolvedAt: new Date(),
      },
    });

    return result;
  } catch (error) {
    console.error("❌ Ошибка при закрытии инцидента:", error);
    return null;
  }
}
