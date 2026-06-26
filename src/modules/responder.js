const causeDescriptions = {
  обрыв_сети: "обрывом контактной сети",
  дтп: "дорожно-транспортным происшествием на путях",
  поломка: "технической неисправностью подвижного состава",
  отключение_тока: "отключением напряжения на линии",
  иная_причина: "внештатной ситуацией",
};

export function generateReply(incident, passengerData) {
  const requestedRoute = passengerData.route
    ? `маршрута №${passengerData.route}`
    : "вашего транспорта";

  if (incident) {
    const causeText =
      causeDescriptions[incident.incidentType] ||
      causeDescriptions["иная_причина"];
    const locationText = incident.location
      ? ` на участке: ${incident.location}`
      : "";

    return (
      `⚠️ Здравствуйте! Задержка ${requestedRoute} связана с ${causeText}${locationText}. ` +
      `Аварийная бригада уже проинформирована. Приносим извинения за временные неудобства.`
    );
  } else {
    return (
      `✅ Здравствуйте! В данный момент на линии ${requestedRoute} активных сбоев не зафиксировано. ` +
      `Возможны небольшие задержки из-за дорожного трафика.`
    );
  }
}
