// Browser stub for pino — WaldiConnect imports pino at runtime in the browser.
// We replace it with a no-op logger so it doesn't crash.
const noop = () => {};
const logger = {
  trace: noop, debug: noop, info: noop,
  warn: noop, error: noop, fatal: noop,
  silent: noop, child: () => logger,
  level: 'silent',
};

function pino() { return logger; }
pino.pino = pino;
pino.default = pino;
pino.destination = noop;
pino.transport = noop;
pino.levels = { values: {}, labels: {} };

module.exports = pino;
module.exports.default = pino;
