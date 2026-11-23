import PrismaClientPkg from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const PrismaClient = PrismaClientPkg.PrismaClient || (PrismaClientPkg as any).default?.PrismaClient;

const dbUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db';

const adapter = new PrismaBetterSqlite3({
  url: dbUrl,
});

export const prisma = new PrismaClient({ adapter });

// High-speed SQLite Pragmas (WAL Mode, in-memory temp store, 64MB cache & memory mapping)
try {
  (prisma as any).$executeRawUnsafe?.(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA temp_store = MEMORY;
    PRAGMA cache_size = -64000;
    PRAGMA mmap_size = 268435456;
  `).catch(() => {});
} catch {}
