const crypto = require('node:crypto');

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function hashValue(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

class DedupeHelper {
  constructor(store, options = {}) {
    this.store = store;
    this.namespace = options.namespace || process.env.TEMPORAL_NAMESPACE || 'ghost-engine';
    this.defaultTtlMs = options.defaultTtlMs || 24 * 60 * 60 * 1000;
  }

  makeKey(scope, input) {
    return `${this.namespace}:${scope}:${hashValue(input)}`;
  }

  async claim(scope, input, metadata = {}) {
    const key = this.makeKey(scope, input);
    const existing = await this.store.get(key);
    if (existing && !this.isExpired(existing)) {
      return {
        deduped: true,
        key,
        record: existing,
      };
    }

    const now = new Date().toISOString();
    const record = {
      key,
      scope,
      inputHash: hashValue(input),
      metadata,
      status: 'claimed',
      claimedAt: now,
      expiresAt: new Date(Date.now() + this.defaultTtlMs).toISOString(),
    };

    await this.store.set(key, record);
    return {
      deduped: false,
      key,
      record,
    };
  }

  async complete(key, result = {}) {
    return this.store.merge(key, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      result,
    });
  }

  async fail(key, error) {
    const errorRecord = error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      : error;

    return this.store.merge(key, {
      status: 'failed',
      failedAt: new Date().toISOString(),
      error: errorRecord,
    });
  }

  isExpired(record) {
    if (!record || !record.expiresAt) {
      return false;
    }
    return Date.now() > Date.parse(record.expiresAt);
  }
}

function createDedupeHelper(store, options) {
  return new DedupeHelper(store, options);
}

module.exports = {
  DedupeHelper,
  createDedupeHelper,
  hashValue,
  stableStringify,
};
