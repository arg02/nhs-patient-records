/**
 * Live ingest storage backends — local filesystem (default) or Cloud Storage (--gcs).
 *
 * Object keys mirror repo paths under `data/live/` locally and `live/` in GCS:
 *   index.json, {YYYY-MM-DD}.json, exposure-last-raw.json, forecast-last-raw.json, _old/…
 */
import {
  writeFileSync,
  mkdirSync,
  readFileSync,
  existsSync,
  readdirSync,
  renameSync,
} from 'fs';
import { dirname, join } from 'path';

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** @typedef {import('./live-store.js').DayFile} DayFile */

/**
 * @typedef {object} LiveStorage
 * @property {() => Promise<void>} ensureReady
 * @property {(name: string) => Promise<object|null>} readJson
 * @property {(name: string, obj: object) => Promise<void>} writeJson
 * @property {(name: string) => Promise<boolean>} exists
 * @property {() => Promise<string[]>} listDayFileKeys
 * @property {(dateKey: string, destName?: string) => Promise<void>} archiveDay
 * @property {'fs'|'gcs'} kind
 * @property {string} label
 */

/**
 * Local filesystem backend — `data/live/` under repo root.
 * @param {string} root
 * @returns {LiveStorage}
 */
export function createFsLiveStorage(root) {
  const baseDir = join(root, 'data', 'live');
  const oldDir = join(baseDir, '_old');

  function abs(name) {
    return join(baseDir, name);
  }

  return {
    kind: 'fs',
    label: baseDir,
    async ensureReady() {
      mkdirSync(baseDir, { recursive: true });
      mkdirSync(oldDir, { recursive: true });
    },
    async readJson(name) {
      const path = abs(name);
      if (!existsSync(path)) return null;
      return parseJson(readFileSync(path, 'utf8'));
    },
    async writeJson(name, obj) {
      const path = abs(name);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(obj, null, 2));
    },
    async exists(name) {
      return existsSync(abs(name));
    },
    async listDayFileKeys() {
      if (!existsSync(baseDir)) return [];
      return readdirSync(baseDir)
        .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
        .map((name) => name.replace(/\.json$/, ''));
    },
    async archiveDay(dateKey, destName) {
      const src = abs(`${dateKey}.json`);
      if (!existsSync(src)) return;
      mkdirSync(oldDir, { recursive: true });
      const dest = join(oldDir, destName || `${dateKey}.json`);
      if (existsSync(dest)) {
        renameSync(src, join(oldDir, `${dateKey}-archived-${Date.now()}.json`));
      } else {
        renameSync(src, dest);
      }
    },
  };
}

/**
 * Cloud Storage backend — prefix `live/` (or GCS_PREFIX) in bucket.
 * @param {{ bucket: string, prefix?: string }} opts
 * @returns {Promise<LiveStorage>}
 */
export async function createGcsLiveStorage({ bucket, prefix = 'live' }) {
  const { Storage } = await import('@google-cloud/storage');
  const storage = new Storage();
  const bucketRef = storage.bucket(bucket);
  const basePrefix = prefix.replace(/\/+$/, '');

  function objectName(name) {
    return `${basePrefix}/${name.replace(/^\/+/, '')}`;
  }

  async function readObjectText(name) {
    const file = bucketRef.file(objectName(name));
    const [exists] = await file.exists();
    if (!exists) return null;
    const [buf] = await file.download();
    return buf.toString('utf8');
  }

  return {
    kind: 'gcs',
    label: `gs://${bucket}/${basePrefix}/`,
    async ensureReady() {
      const [exists] = await bucketRef.exists();
      if (!exists) {
        throw new Error(`GCS bucket gs://${bucket} does not exist — create it before ingest`);
      }
    },
    async readJson(name) {
      const text = await readObjectText(name);
      if (text == null) return null;
      return parseJson(text);
    },
    async writeJson(name, obj) {
      const file = bucketRef.file(objectName(name));
      await file.save(JSON.stringify(obj, null, 2), {
        contentType: 'application/json',
        resumable: false,
      });
    },
    async exists(name) {
      const [exists] = await bucketRef.file(objectName(name)).exists();
      return exists;
    },
    async listDayFileKeys() {
      const [files] = await bucketRef.getFiles({ prefix: `${basePrefix}/` });
      const keys = new Set();
      const dayRe = new RegExp(`^${basePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(\\d{4}-\\d{2}-\\d{2})\\.json$`);
      for (const file of files) {
        const m = file.name.match(dayRe);
        if (m) keys.add(m[1]);
      }
      return [...keys];
    },
    async archiveDay(dateKey, destName) {
      const srcName = `${dateKey}.json`;
      const src = bucketRef.file(objectName(srcName));
      const [exists] = await src.exists();
      if (!exists) return;
      const dest = destName || `${dateKey}.json`;
      const destFile = bucketRef.file(objectName(`_old/${dest}`));
      const [destExists] = await destFile.exists();
      const finalDest = destExists
        ? `_old/${dateKey}-archived-${Date.now()}.json`
        : `_old/${dest}`;
      await src.copy(bucketRef.file(objectName(finalDest)));
      await src.delete();
    },
  };
}

/**
 * Resolve storage from CLI flags / env (async for GCS client init).
 * @param {{ root: string, gcs?: boolean, bucket?: string, prefix?: string }} opts
 * @returns {Promise<LiveStorage>}
 */
export async function resolveLiveStorage({ root, gcs = false, bucket, prefix }) {
  if (gcs) {
    const b = bucket || process.env.GCS_BUCKET || `${process.env.GOOGLE_CLOUD_PROJECT || 'nhs-patient-records'}-live`;
    return createGcsLiveStorage({ bucket: b, prefix: prefix || process.env.GCS_PREFIX || 'live' });
  }
  return createFsLiveStorage(root);
}
