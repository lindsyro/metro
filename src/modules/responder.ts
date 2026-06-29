import type { PassengerData } from "../types.js";

const causeDescriptions: Record<string, string> = {
  обрыв_сети: "обрывом контактной сети",
  дтп: "дорожно-транспортным происшествием на путях",
  поломка: "технической неисправностью подвижного состава",
  отключение_тока: "отключением напряжения на линии",
  иная_причина: "внештатной ситуацией",
};

export function generateReply(incidents: any[], passengerData: PassengerData) {
  // 1. ПРИОРИТЕТ: Пользователь спросил про конкретный маршрут
  if (passengerData.route) {
    const routeIncidents = incidents.filter((i) =>
      i.routes.includes(passengerData.route),
    );

    // Если нашли проблемы по этому маршруту
    if (routeIncidents.length > 0) {
      const causes = [
        ...new Set(
          routeIncidents.map(
            (i) =>
              causeDescriptions[i.incidentType] ||
              causeDescriptions["иная_причина"],
          ),
        ),
      ].join(" и ");

      const directions = [
        ...new Set(routeIncidents.map((i) => i.direction).filter(Boolean)),
      ].join(" и ");
      const directionText = directions ? ` (направление: ${directions})` : "";

      return (
        `⚠️ Здравствуйте! К сожалению, на маршруте №${passengerData.route}${directionText} сейчас сложная ситуация: ` +
        `движение затруднено в связи с ${causes}. ` +
        `Аварийные бригады уже работают. Приносим извинения за неудобства.`
      );
    }

    // Если по этому маршруту проблем нет — молчим про другие и просто сообщаем норму
    return `✅ На маршруте №${passengerData.route} активных сбоев не зафиксировано. Возможно, задержка вызвана дорожной ситуацией.`;
  }

  // 2. ОБЩИЙ ЗАПРОС: Пользователь не указал маршрут (например, "почему нет троллейбуса?")
  // Фильтруем инциденты по типу транспорта, если он определен
  let displayIncidents = incidents;
  if (passengerData.transportType) {
    displayIncidents = incidents.filter(
      (i) => i.transportType === passengerData.transportType,
    );
  }

  // Если сбоев по нужному типу транспорта нет
  if (!displayIncidents || displayIncidents.length === 0) {
    return `✅ В настоящее время активных сбоев на линии вашего транспорта не зафиксировано.`;
  }

  // Формируем список для общего запроса
  const grouped = displayIncidents.reduce((acc: Record<string, string[]>, incident: any) => {
    incident.routes.forEach((route: string) => {
      if (!acc[route]) acc[route] = [];
      acc[route].push(
        causeDescriptions[incident.incidentType] ||
          causeDescriptions["иная_причина"],
      );
    });
    return acc;
  }, {});

  const list = Object.entries(grouped)
    .map(([route, causes]) => {
      const uniqueCauses = [...new Set(causes)].join(" и ");
      return `• Маршрут ${route}: в связи с ${uniqueCauses}`;
    })
    .join("\n");

  return `ℹ️ По вашему запросу зафиксированы задержки:\n${list}\n\nСпециалисты работают над устранением.`;
}
