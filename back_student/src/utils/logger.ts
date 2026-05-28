/* tslint:disable:no-var-requires */
const pino = require('pino');

/**
 * Structured logger — writes JSON lines to stdout for New Relic log forwarding.
 */
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: 'cia-backend-api',
  },
});

export default logger;
