import http from 'http';
import { createApp } from './app.js';
import { initSocketServer } from './socket/index.js';
import { startScheduledMessageWorker } from './workers/scheduled-message.worker.js';
import { startDisappearingMessageWorker } from './workers/disappearing-message.worker.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  const app = createApp();
  const server = http.createServer(app);

  // Initialize Socket.IO real-time server
  initSocketServer(server);

  // Initialize background workers for scheduled and disappearing messages
  const scheduledWorker = startScheduledMessageWorker();
  const disappearingWorker = startDisappearingMessageWorker();

  server.listen(env.PORT, () => {
    logger.info(`🚀 Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    logger.info(`Health check available at http://localhost:${env.PORT}/healthz`);
  });

  // Graceful shutdown
  const signals = ['SIGTERM', 'SIGINT'];
  signals.forEach((signal) => {
    process.on(signal, () => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      scheduledWorker.stop();
      disappearingWorker.stop();
      server.close(() => {
        logger.info('HTTP server closed.');
        process.exit(0);
      });

      // Force shutdown after 10s if connections fail to close
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    });
  });
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Fatal error during server startup');
  process.exit(1);
});
