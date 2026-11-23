import { createApp } from './app.js';
import { config } from './config/index.js';
import { taskQueue } from './queues/index.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[WorkSphere Core API] Running in ${config.env} mode on http://localhost:${config.port}`);
  console.log(`[WorkSphere Core API] Health live: http://localhost:${config.port}/health/live`);
  console.log(`[WorkSphere Core API] Metrics: http://localhost:${config.port}/metrics`);
});

// Graceful shutdown handling
const shutdown = async (signal: string) => {
  console.log(`Received ${signal}. Gracefully shutting down...`);
  server.close(async () => {
    await taskQueue.shutdown();
    console.log('WorkSphere Core API shut down cleanly.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

