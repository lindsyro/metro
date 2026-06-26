import { prisma } from '../db/prisma.js';

// --- ДЛЯ ДИСПЕТЧЕРА (Модуль 4.1) ---
export async function createIncident(data) {
    try {
        const incident = await prisma.incident.create({
            data: {
                incidentType: data.incidentType || 'иная_причина',
                routes: Array.isArray(data.routes) ? data.routes : [],
                location: data.location || null
            }
        });
        return incident;
    } catch (error) {
        console.error("Ошибка при сохранении инцидента:", error);
        return null;
    }
}

// --- ДЛЯ ПАССАЖИРА (Модуль 4.3) ---
export async function findRelevantIncident(data) {
    try {
        const whereClause = { status: 'active' };

        if (data.route) {
            whereClause.routes = { has: data.route };
        } else if (data.transportType) {
            whereClause.transportType = data.transportType;
        }

        const incident = await prisma.incident.findFirst({
            where: whereClause,
            orderBy: { createdAt: 'desc' }
        });

        return incident;
    } catch (error) {
        console.error("Ошибка при поиске инцидента:", error);
        return null;
    }
}