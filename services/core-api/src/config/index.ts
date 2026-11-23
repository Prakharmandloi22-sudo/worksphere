import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',

  database: {
    url: process.env.DATABASE_URL || 'postgres://worksphere:worksphere_secret@localhost:5432/worksphere_db',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'worksphere_db',
    user: process.env.DB_USER || 'worksphere',
    password: process.env.DB_PASSWORD || 'worksphere_secret',
    poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DB_POOL_MAX || '20', 10),
    timeoutMs: parseInt(process.env.DB_TIMEOUT_MS || '5000', 10),
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'worksphere-super-secure-jwt-key-2026-production-testing-token',
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
    refreshExpirationDays: 7,
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },

  analytics: {
    serviceUrl: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:8000',
    apiKey: process.env.ANALYTICS_SERVICE_API_KEY || 'm2m-service-token-worksphere-analytics-2026',
  },

  webhook: {
    signingSecret: process.env.WEBHOOK_SIGNING_SECRET || 'whsec_worksphere_test_signing_secret_xyz123',
  },

  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    bucket: process.env.STORAGE_BUCKET || 'worksphere-attachments',
  },

  email: {
    provider: process.env.EMAIL_PROVIDER || 'mock',
    from: process.env.EMAIL_FROM || 'notifications@worksphere.io',
  },
};

