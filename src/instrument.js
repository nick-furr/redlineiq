import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  // Capture 100% of transactions in dev, lower in prod via env var
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) || 1.0,
  // Only initialize if DSN is set — no-ops gracefully in local dev without it
  enabled: Boolean(process.env.SENTRY_DSN),
});
