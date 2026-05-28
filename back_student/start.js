// Start wrapper - waits for DB port then starts the compiled app
const net = require('net');
const logger = require('./build/utils/logger').default;

function masked(val) {
  if (!val) return '';
  if (val.length <= 4) return '****';
  return val.slice(0, 2) + '****' + val.slice(-2);
}

function waitForPort(host, port, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function tryConnect() {
      const socket = net.createConnection({ host, port }, () => {
        socket.end();
        resolve();
      });
      socket.on('error', (err) => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) return reject(err);
        setTimeout(tryConnect, 1000);
      });
    }
    tryConnect();
  });
}

(async function main() {
  try {
    logger.info(
      {
        dbHost: process.env.DB_HOST,
        dbPort: process.env.DB_PORT,
        dbUser: process.env.DB_USER,
        dbName: process.env.DB_NAME,
        jwtSecret: masked(process.env.JWT_SECRET),
      },
      'Container environment snapshot',
    );

    const host = process.env.DB_HOST || 'localhost';
    const port = Number(process.env.DB_PORT || 3306);
    logger.info({ host, port }, 'Waiting for database to be reachable');
    await waitForPort(host, port, 60000).catch((err) => {
      logger.warn(
        { err, host, port },
        'DB port check failed (timed out); continuing — TypeORM will connect directly',
      );
    });

    require('./build/index.js');
  } catch (err) {
    logger.error({ err }, 'Startup wrapper failed');
    process.exit(1);
  }
})();
