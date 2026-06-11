require('dotenv').config();
const { PrismaClient } = require('../generated/prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

// 어댑터에 연결 URL 정보가 담긴 객체를 직접 제공합니다.
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./prisma/dev.db"
});

const prisma = new PrismaClient({ adapter });

module.exports = prisma;