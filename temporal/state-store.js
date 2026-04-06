const fs = require('node:fs/promises');
const path = require('node:path');

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

class JsonStateStore {
  constructor(options = {}) {
    this.filePath = options.filePath || process.env.TEMPORAL_STATE_PATH || './data/temporal-state.json';
    this.namespace = options.namespace || process.env.TEMPORAL_NAMESPACE || 'ghost-engine';
    this.logger = options.logger || console;
    this._cache = null;
    this._loaded = false;
    this._writing = Promise.resolve();
  }

  async load() {
    if (this._loaded) {
      return this._cache;
    }

    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      this._cache = JSON.parse(raw);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        this._cache = { namespaces: {} };
        await this.persist();
      } else {
        throw error;
      }
    }

    if (!this._cache.namespaces) {
      this._cache.namespaces = {};
    }

    this._loaded = true;
    return this._cache;
  }

  async persist() {
    const target = this._cache || { namespaces: {} };
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    this._writing = this._writing.then(() => fs.writeFile(this.filePath, JSON.stringify(target, null, 2)));
    await this._writing;
    return target;
  }

  _namespaceBucket() {
    if (!this._cache) {
      this._cache = { namespaces: {} };
    }
    if (!this._cache.namespaces[this.namespace]) {
      this._cache.namespaces[this.namespace] = {};
    }
    return this._cache.namespaces[this.namespace];
  }

  async get(key) {
    await this.load();
    const bucket = this._namespaceBucket();
    return clone(bucket[key]);
  }

  async set(key, value) {
    await this.load();
    const bucket = this._namespaceBucket();
    bucket[key] = clone(value);
    await this.persist();
    return clone(bucket[key]);
  }

  async merge(key, patch) {
    await this.load();
    const bucket = this._namespaceBucket();
    const current = bucket[key] || {};
    bucket[key] = {
      ...current,
      ...clone(patch),
    };
    await this.persist();
    return clone(bucket[key]);
  }

  async delete(key) {
    await this.load();
    const bucket = this._namespaceBucket();
    const existed = Object.prototype.hasOwnProperty.call(bucket, key);
    delete bucket[key];
    await this.persist();
    return existed;
  }

  async list(prefix = '') {
    await this.load();
    const bucket = this._namespaceBucket();
    return Object.entries(bucket)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => ({ key, value: clone(value) }));
  }

  async replace(key, updater) {
    const current = await this.get(key);
    const next = typeof updater === 'function' ? updater(clone(current)) : updater;
    return this.set(key, next);
  }
}

function createStateStore(options) {
  return new JsonStateStore(options);
}

module.exports = {
  JsonStateStore,
  createStateStore,
};
