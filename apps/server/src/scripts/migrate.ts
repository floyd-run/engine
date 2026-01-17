import * as path from 'path';
import { fileURLToPath } from 'url';
import { FileMigrationProvider, Migrator } from 'kysely';
import { promises as fs } from 'fs';
import { config } from 'config';
import { db } from 'database/client';
import { logger } from 'lib/logger';


async function migrate() {
  const url = config.DATABASE_URL;

  if (!url) {
    logger.error('❌ Missing DATABASE_URL');
    process.exit(1);
  }

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(path.dirname(fileURLToPath(import.meta.url)), '../migrations')
    })
  });

  const command = process.argv[2];

  const { error, results } = await runCommand(migrator, command ?? 'latest');

  results?.forEach((it) => {
    if (it.status === 'Success') {
      logger.info(`✅  ${it.migrationName} (${it.direction})`);
    } else if (it.status === 'Error') {
      logger.error(`❌  ${it.migrationName} failed`);
    }
  });

  if (error) {
    logger.error('❌  Migration failed');
    logger.error(error);
    process.exit(1);
  }

  await db.destroy();
}

async function runCommand(migrator: Migrator, command: string) {
  switch (command) {
    case 'latest':
      return await migrator.migrateToLatest();

    case 'down':
      return await migrator.migrateDown();

    case 'redo': {
      logger.info('Rolling back one step...');
      const downRes = await migrator.migrateDown();
      if (downRes.error) return downRes;

      logger.info('Re-applying latest...');
      return await migrator.migrateToLatest();
    }

    default:
      logger.error('Unknown command. Use: latest, down, or redo');
      process.exit(1);
  }
}

migrate().catch(logger.error);