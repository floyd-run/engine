import fs from 'fs';
import { logger } from 'lib/logger';
import path from 'path';
import { fileURLToPath } from 'url';

const migrationName = process.argv[2];

if (!migrationName) {
  logger.error('Please provide a migration name. Usage: pnpm migrate:create my_migration');
  process.exit(1);
}

const timestamp = new Date()
  .toISOString()
  .replace(/[-T:.Z]/g, '')
  .slice(0, 14);
const fileName = `${timestamp}_${migrationName}.ts`;

const content = `import type { Database } from 'database/schema';
import { Kysely } from 'kysely';

export async function up(db: Kysely<Database>): Promise<void> {
  // await db.schema.createTable('...').execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  // await db.schema.dropTable('...').execute();
}
`;

const filePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../migrations', fileName);

fs.writeFileSync(filePath, content);

logger.info(`✅ Created migration: migrations/${fileName}`);
