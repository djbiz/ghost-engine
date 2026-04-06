function createLogger(scope, baseContext = {}) {
  const emit = (level, message, context = {}) => {
    const payload = {
      ts: new Date().toISOString(),
      level,
      scope,
      message,
      ...baseContext,
      ...context,
    };
    const serialized = JSON.stringify(payload);
    if (level === 'error') {
      console.error(serialized);
      return;
    }
    if (level === 'warn') {
      console.warn(serialized);
      return;
    }
    if (level === 'debug') {
      console.debug(serialized);
      return;
    }
    console.log(serialized);
  };

  return {
    scope,
    child(extra = {}) {
      return createLogger(scope, { ...baseContext, ...extra });
    },
    info(message, context) {
      emit('info', message, context);
    },
    warn(message, context) {
      emit('warn', message, context);
    },
    error(message, context) {
      emit('error', message, context);
    },
    debug(message, context) {
      emit('debug', message, context);
    },
    emit,
  };
}

function createMetrics(scope) {
  const counters = new Map();
  const gauges = new Map();
  const histograms = new Map();

  const keyFor = (name, labels = {}) => `${name}:${JSON.stringify(labels)}`;

  return {
    increment(name, value = 1, labels = {}) {
      const key = keyFor(name, labels);
      counters.set(key, (counters.get(key) || 0) + value);
      return counters.get(key);
    },
    gauge(name, value, labels = {}) {
      const key = keyFor(name, labels);
      gauges.set(key, value);
      return value;
    },
    observe(name, value, labels = {}) {
      const key = keyFor(name, labels);
      const bucket = histograms.get(key) || [];
      bucket.push(value);
      histograms.set(key, bucket);
      return value;
    },
    snapshot() {
      return {
        scope,
        counters: Object.fromEntries(counters.entries()),
        gauges: Object.fromEntries(gauges.entries()),
        histograms: Object.fromEntries(histograms.entries()),
      };
    },
  };
}

function createTracer(scope, logger = createLogger(scope)) {
  return {
    async withSpan(name, attributes, fn) {
      const startedAt = Date.now();
      logger.debug('span.start', { span: name, attributes });
      try {
        const result = await fn();
        logger.debug('span.end', { span: name, durationMs: Date.now() - startedAt });
        return result;
      } catch (error) {
        logger.error('span.error', {
          span: name,
          durationMs: Date.now() - startedAt,
          error: {
            name: error?.name,
            message: error?.message,
          },
        });
        throw error;
      }
    },
  };
}

function createObservability(scope, baseContext = {}) {
  const logger = createLogger(scope, baseContext);
  const metrics = createMetrics(scope);
  const tracer = createTracer(scope, logger);

  return {
    logger,
    metrics,
    tracer,
  };
}

module.exports = {
  createLogger,
  createMetrics,
  createTracer,
  createObservability,
};
