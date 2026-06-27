// Импортируем готового клиента из нашего приложения
import { prisma } from "../src/database/prisma.js";

async function main() {
  console.log("⏳ Начинаем заполнение базы данных...");

  const incidents = await prisma.incident.createMany({
    data: [
      {
        status: "active",
        incidentType: "дтп",
        transportType: "tram",
        routes: ["4", "7"],
        location: "перекресток Ленина и Мира",
      },
      {
        status: "active",
        incidentType: "обрыв_сети",
        transportType: "trolleybus",
        routes: ["12", "15"],
        location: "проспект Октября",
      },
      {
        status: "active",
        incidentType: "отключение_тока",
        transportType: "tram",
        routes: ["1", "3", "5"],
        location: "Западное депо",
      },
      {
        status: "resolved",
        incidentType: "поломка",
        transportType: "bus",
        routes: ["24"],
        location: 'остановка "Центральная"',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        resolvedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      },
      {
        status: "active",
        incidentType: "иная_причина",
        transportType: null,
        routes: ["42"],
        location: "мост через реку",
      },
      {
        status: "active",
        incidentType: "дтп",
        transportType: "trolleybus",
        routes: ["12"],
        location: "остановка площадь Труда",
      },
    ],
    skipDuplicates: true,
  });

  console.log(`✅ Успешно добавлено тестовых записей: ${incidents.count}`);
}

main()
  .catch((e) => {
    console.error("❌ Ошибка при заполнении БД:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
