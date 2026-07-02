import type { PassengerData } from "../types.js";

const causeDescriptions: Record<string, string> = {
  обрыв_сети: "обрывом контактной сети",
  дтп: "дорожно-транспортным происшествием на путях",
  поломка: "технической неисправностью подвижного состава",
  отключение_тока: "отключением напряжения на линии",
  иная_причина: "внештатной ситуацией",
};

export function generateReply(incidents: any[], passengerData: PassengerData) {
  const requestedRoutes = passengerData.routes || [];
  
  // Проверяем, дал ли пассажир ХОТЬ КАКИЕ-ТО вводные данные
  const hasSpecifics = requestedRoutes.length > 0 || passengerData.location || passengerData.transportType;

  // 1. СЦЕНАРИЙ: АБСТРАКТНАЯ ЖАЛОБА ("не могу уехать", "долго жду")
  if (!hasSpecifics) {
    if (!incidents || incidents.length === 0) {
      return `✅ В данный момент крупных сбоев в сети транспорта не зафиксировано. Пожалуйста, уточните номер маршрута, чтобы я мог дать точный ответ.`;
    }
    
    // Если инциденты есть, выводим общую городскую сводку, но просим конкретики
    const grouped = groupIncidents(incidents);
    const list = formatGroupedIncidents(grouped);
    return `ℹ️ Вы не указали маршрут. Сейчас в городе зафиксированы следующие задержки:\n${list}\n\nПожалуйста, уточните ваш маршрут, если его нет в списке.`;
  }

  // 2. СЦЕНАРИЙ: ПАССАЖИР УКАЗАЛ ЧТО-ТО КОНКРЕТНОЕ
  let requestedContext = "";
  if (requestedRoutes.length > 0) {
    requestedContext = `на маршруте №${requestedRoutes.join(", ")}`;
  } else if (passengerData.location) {
    requestedContext = `в районе "${passengerData.location}"`;
  } else if (passengerData.transportType) {
    const types: Record<string, string> = { tram: 'трамваев', trolleybus: 'троллейбусов', metro: 'метро' };
    requestedContext = `в движении ${types[passengerData.transportType] || 'транспорта'}`;
  }

  // 3. ПРИОРИТЕТ: Запрос по конкретному маршруту
  if (requestedRoutes.length > 0) {
    const routeIncidents = incidents.filter((i) =>
      i.routes.some((r: string) => requestedRoutes.includes(r))
    );

    if (routeIncidents.length > 0) {
      const causes = [...new Set(routeIncidents.map(i => causeDescriptions[i.incidentType] || causeDescriptions["иная_причина"]))].join(" и ");
      const directions = [...new Set(routeIncidents.map((i) => i.direction).filter(Boolean))].join(" и ");
      const directionText = directions ? ` (направление: ${directions})` : "";

      return `⚠️ Здравствуйте! К сожалению, ${requestedContext}${directionText} сейчас сложная ситуация: движение затруднено в связи с ${causes}. Аварийные бригады уже работают. Приносим извинения за неудобства.`;
    }

    const capitalizedContext = requestedContext.charAt(0).toUpperCase() + requestedContext.slice(1);
    return `✅ ${capitalizedContext} активных сбоев не зафиксировано. Возможно, задержка вызвана дорожной ситуацией.`;
  }

  // 4. ОБЩИЙ ЗАПРОС ПО ЛОКАЦИИ ИЛИ ТИПУ (Без номера маршрута)
  let displayIncidents = incidents;
  if (passengerData.transportType) {
    displayIncidents = incidents.filter(i => i.transportType === passengerData.transportType);
  }

  if (!displayIncidents || displayIncidents.length === 0) {
    const capitalizedContext = requestedContext.charAt(0).toUpperCase() + requestedContext.slice(1);
    return `✅ ${capitalizedContext} активных сбоев не зафиксировано. Возможно, задержка вызвана дорожной ситуацией.`;
  }

  const grouped = groupIncidents(displayIncidents);
  const list = formatGroupedIncidents(grouped);
  return `ℹ️ По вашему запросу зафиксированы задержки:\n${list}\n\nСпециалисты работают над устранением.`;
}

// --- Вспомогательные функции для чистоты кода ---

function groupIncidents(incidentsList: any[]) {
  return incidentsList.reduce((acc: Record<string, string[]>, incident: any) => {
    incident.routes.forEach((route: string) => {
      if (!acc[route]) acc[route] = [];
      acc[route].push(causeDescriptions[incident.incidentType] || causeDescriptions["иная_причина"]);
    });
    return acc;
  }, {});
}

function formatGroupedIncidents(grouped: Record<string, string[]>) {
  return Object.entries(grouped)
    .map(([route, causes]) => {
      const uniqueCauses = [...new Set(causes)].join(" и ");
      return `• Маршрут ${route}: в связи с ${uniqueCauses}`;
    })
    .join("\n");
}