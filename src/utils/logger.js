const isProd = import.meta.env.PROD;

const logger = {
  log: isProd ? () => {} : (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

export default logger;
