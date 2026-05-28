'use strict'
exports.config = {
  app_name: ['cia-backend-api'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  logging: { level: 'info' },
  application_logging: {
      enabled: true,
      forwarding: {
        enabled: true
      }
    }
}
