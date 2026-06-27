// Импортируем готового клиента
import { prisma } from '../src/database/prisma.js';

async function main() {
  console.log('🧹 Очистка базы данных...');
  
  const deleted = await prisma.incident.deleteMany({});
  
  console.log(`✅ База данных успешно очищена. Удалено записей: ${deleted.count}`);
}

main()
  .catch((e) => {
    console.error("❌ Ошибка при очистке БД:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });