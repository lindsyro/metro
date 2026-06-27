// Импортируем готового клиента из нашего приложения
import { prisma } from "../src/database/prisma.js";

async function main() {
  console.log("⏳ Начинаем заполнение базы данных...");

  const incidents = [
    // 1. Трамвай (ДТП на путях)
    {
      status: "active",
      incidentType: "ДТП стороннего транспорта",
      transportType: "tram",
      routes: ["5", "5а"],
      location: "ул. Гладилова / ул. Несмелова",
      direction: "в сторону Ж/Д Вокзала",
    },
    // 2. Троллейбус (Обрыв сети)
    {
      status: "active",
      incidentType: "обрыв контактной сети",
      transportType: "trolleybus",
      routes: ["12"],
      location: "проспект Альберта Камалеева",
      direction: "в направлении ТЦ Мега",
    },
    // 3. Метро (Техническая неисправность)
    {
      status: "active",
      incidentType: "поломка состава",
      transportType: "metro",
      routes: ["1"], // Центральная линия
      location: "перегон Дубравная - Проспект Победы",
      direction: "к станции Аметьево",
    },
    // 4. Трамвай (Уже решенный инцидент для истории)
    {
      status: "resolved",
      incidentType: "отсутствие напряжения",
      transportType: "tram",
      routes: ["4"],
      location: "Сибирский тракт",
      direction: "к остановке Халитова",
      resolvedAt: new Date(),
    },
    // 5. Троллейбус (Задержка без конкретного маршрута - влияет на всё направление)
    {
      status: "active",
      incidentType: "затрудненное движение / пробка",
      transportType: "trolleybus",
      routes: [], // Массив пустой, значит влияет на всех
      location: "Оренбургский тракт",
      direction: "в центр города",
    },
  ];

  for (const incident of incidents) {
    await prisma.incident.create({
      data: incident,
    });
  }

  console.log("✅ База данных успешно заполнена тестовыми данными!");
}

main()
  .catch((e) => {
    console.error("❌ Ошибка при заполнении БД:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
