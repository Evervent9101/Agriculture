const { createApp } = require('./app');
const { createPool, migrate } = require('./db');

const PORT = process.env.PORT || 3000;

async function main() {
  const pool = createPool();
  await migrate(pool);

  const app = createApp({ pool });
  const server = app.listen(PORT, () => {
    console.log(`farm backend listening on :${PORT}`);
  });

  // Graceful shutdown so `pm2 reload` does not drop requests
  const shutdown = (signal) => {
    console.log(`${signal} received, closing server`);
    server.close(async () => {
      await pool.end().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('startup failed:', err.message);
  process.exit(1);
});
