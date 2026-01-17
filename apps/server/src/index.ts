import { serve } from '@hono/node-server';
import { config } from 'config';

async function main() {
  const { default: app } = await import('./app');

  serve(
    {
      fetch: app.fetch,
      port: config.PORT
    },
    (info) => {
      console.log(`Server started at ${info.port}`);
    }
  );
}

main().catch(console.error);
