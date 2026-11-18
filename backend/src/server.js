const http = require('http');
const connectDB = require('./config/db');
const config = require('./config');
const app = require('./app');
const { initSocketIO } = require('./services/socketService');

const start = async () => {
  try {
    await connectDB();
  } catch (err) {
    console.error('Could not connect to MongoDB. Server not started.');
    process.exit(1);
  }

  // Socket.IO shares the same HTTP server as Express so admin clients receive
  // real-time order events over the standard port.
  const server = http.createServer(app);
  initSocketIO(server);

  server.listen(config.port, () => {
    console.log(
      `Server running in ${config.env} mode on port ${config.port}`
    );
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`${signal} received, closing server...`);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

start();

module.exports = app;
