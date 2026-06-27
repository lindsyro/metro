import { prisma } from "../database/prisma.js";

// --- ДЛЯ ДИСПЕТЧЕРА (Модуль 4.1) ---
export async function createIncident(data) {
  try {
    const incomingRoutes = Array.isArray(data.routes) ? data.routes : [];

    // 1. ИЩЕМ СУЩЕСТВУЮЩИЙ АКТИВНЫЙ ИНЦИДЕНТ
    // Проверяем, есть ли авария ТАКОГО ЖЕ типа, у которой совпадает хотя бы один маршрут
    if (incomingRoutes.length > 0) {
      const existingIncident = await prisma.incident.findFirst({
        where: {
          status: "active",
          incidentType: data.incidentType || "иная_причина",
          routes: {
            hasSome: incomingRoutes, // hasSome ищет пересечения в массивах
          },
        },
      });

      // Если нашли дубликат — не плодим новые строки!
      if (existingIncident) {
        // Объединяем старые маршруты и новые, убирая дубликаты с помощью Set
        const mergedRoutes = [
          ...new Set([...existingIncident.routes, ...incomingRoutes]),
        ];

        // Обновляем существующий инцидент (вдруг добавились новые маршруты или локация)
        const updatedIncident = await prisma.incident.update({
          where: { id: existingIncident.id },
          data: {
            routes: mergedRoutes,
            // Если в новой заявке пришла локация, а в старой её не было — запишем её
            location: data.location || existingIncident.location,
            direction: data.direction || existingIncident.direction,
          },
        });

        // Возвращаем инцидент и флаг isNew: false (чтобы бот знал, что это дубликат)
        return { incident: updatedIncident, isNew: false };
      }
    }

    // 2. ЕСЛИ ДУБЛИКАТОВ НЕ НАЙДЕНО — СОЗДАЕМ НОВЫЙ ИНЦИДЕНТ
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
    console.error("Ошибка при сохранении/поиске инцидента:", error);
    return null;
  }
}

// --- ДЛЯ ПАССАЖИРА (Модуль 4.3) ---
export async function findRelevantIncident(parsedData) {
  try {
    const whereClause = { status: "active" };

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
export async function resolveIncident(data) {
  // Если нет ни маршрутов, ни локации — мы не знаем, что закрывать
  if ((!data.routes || data.routes.length === 0) && !data.location) {
    return { count: 0 };
  }

  try {
    // Собираем условия (OR: либо совпали маршруты, либо совпала локация)
    const conditions = [];

    if (data.routes && data.routes.length > 0) {
      conditions.push({ routes: { hasSome: data.routes } });
    }

    if (data.location) {
      conditions.push({
        location: {
          contains: data.location,
          mode: "insensitive", // Игнорируем заглавные/строчные буквы
        },
      });
    }

    if (data.direction) {
      conditions.push({
        direction: {
          contains: data.direction,
          mode: "insensitive",
        },
      });
    }

    const result = await prisma.incident.updateMany({
      where: {
        status: "active",
        OR: conditions, // Ищем по любому из совпадений
      },
      data: {
        status: "resolved",
        resolvedAt: new Date(),
      },
    });

    return result;
  } catch (error) {
    console.error("Ошибка при закрытии инцидента в БД:", error);
    return null;
  }
}
