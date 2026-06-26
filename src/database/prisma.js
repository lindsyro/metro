import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

// 1. Создаем пул подключений через классический pg
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
});

// 2. Создаем адаптер для Prisma
const adapter = new PrismaPg(pool);

// 3. Передаем адаптер в клиент
export const prisma = new PrismaClient({ adapter });