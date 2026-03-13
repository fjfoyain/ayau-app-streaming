import * as Sentry from '@sentry/react';

const isProd = import.meta.env.PROD;

const logger = {
  log: isProd ? () => {} : (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (message, context) => {
    console.error(message, context);
    if (isProd) {
      const err = context?.err instanceof Error ? context.err : new Error(message);
      Sentry.captureException(err, { extra: context });
    }
  },
};

export default logger;
