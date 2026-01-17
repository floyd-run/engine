import * as path from 'path';
import { fileURLToPath } from 'url';
import { FileMigrationProvider, Migrator } from 'kysely';
import { promises as fs } from 'fs';
import { config } from 'config';
import { db } from 'database/client';


async function migrate() {
  const url = config.DATABASE_URL;

  if (!url) {
    console.error('❌ Missing DATABASE_URL');
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

  const { error, results } = await runCommand(migrator, command || 'latest');

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`✅  ${it.migrationName} (${it.direction})`);
    } else if (it.status === 'Error') {
      console.error(`❌  ${it.migrationName} failed`);
    }
  });

  if (error) {
    console.error('❌  Migration failed');
    console.error(error);
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
      console.log('Rolling back one step...');
      const downRes = await migrator.migrateDown();
      if (downRes.error) return downRes;

      console.log('Re-applying latest...');
      return await migrator.migrateToLatest();
    }

    default:
      console.error('Unknown command. Use: latest, down, or redo');
      process.exit(1);
  }
}

migrate();