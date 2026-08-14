#!/usr/bin/env node
/**
 * Cloud Run HTTP wrapper for hourly live ingest → GCS `live/*.json`.
 *
 * Routes:
 *   GET /health              — liveness
 *   GET|POST /run            — one hourly ingest (--live --gcs; no seed)
 *   GET /data/live/index.json
 *   GET /data/live/{date}.json — read live JSON from GCS (Cache-Control: no-store)
 */
import http from 'http';
import { runHourlyIngest } from '../scripts/hourly-ingest.mjs';
import { resolveLiveStorage } from '../js/live-storage.js';

const PORT = Number(process.env.PORT || 8080);
const REPO_ROOT = process.cwd();
let running = false;
/** @type {Promise<import('../js/live-storage.js').LiveStorage>|null} */
let liveStoragePromise = null;

function getLiveStorage() {
  if (!liveStoragePromise) {
    liveStoragePromise = resolveLiveStorage({
      root: REPO_ROOT,
      gcs: true,
      bucket: process.env.GCS_BUCKET,
      prefix: process.env.GCS_PREFIX,
    });
  }
  return liveStoragePromise;
}

function sendJson(res, status, body, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...extraHeaders });
  res.end(JSON.stringify(body));
}

function sendJsonNoStore(res, status, body) {
  sendJson(res, status, body, { 'Cache-Control': 'no-store' });
}

/** When Cloud Run is `--allow-unauthenticated`, /run still needs a Bearer token (Scheduler OIDC). */
function requireRunAuth(req, res) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    sendJson(res, 401, { ok: false, error: 'Authorization required' });
    return false;
  }
  return true;
}

function applyLiveDataCors(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
}

const LIVE_JSON_NAME = /^[\w.-]+\.json$/;

const server = http.createServer(async (req, res) => {
  const path = (req.url || '/').split('?')[0];

  if (path === '/health') {
    sendJson(res, 200, {
      status: 'ok',
      service: 'live-ingest',
      project: process.env.GOOGLE_CLOUD_PROJECT || null,
      bucket: process.env.GCS_BUCKET || null,
    });
    return;
  }

  const liveDataMatch = path.match(/^\/data\/live\/(.+\.json)$/);
  if (liveDataMatch) {
    applyLiveDataCors(req, res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-store',
        ...(req.headers.origin ? { 'Access-Control-Allow-Origin': req.headers.origin, Vary: 'Origin' } : {}),
      });
      res.end();
      return;
    }
    if (req.method !== 'GET') {
      sendJsonNoStore(res, 405, { error: 'Method not allowed' });
      return;
    }
    const name = liveDataMatch[1];
    if (!LIVE_JSON_NAME.test(name) || name.includes('..')) {
      sendJsonNoStore(res, 400, { error: 'Invalid path' });
      return;
    }
    try {
      const storage = await getLiveStorage();
      const data = await storage.readJson(name);
      if (!data) {
        sendJsonNoStore(res, 404, { error: 'Not found', name });
        return;
      }
      sendJsonNoStore(res, 200, data);
    } catch (err) {
      console.error('serveLiveData failed:', err);
      sendJsonNoStore(res, 500, { error: err.message, type: err.name });
    }
    return;
  }

  if (path === '/run' && (req.method === 'GET' || req.method === 'POST')) {
    if (process.env.REQUIRE_RUN_BEARER === '1' && !requireRunAuth(req, res)) return;
    if (running) {
      sendJson(res, 429, { ok: false, error: 'Ingest already running' });
      return;
    }
    running = true;
    const started = Date.now();
    try {
      const result = await runHourlyIngest({ live: true, gcs: true, seed: false, advance: false });
      sendJson(res, 200, {
        ok: true,
        elapsedMs: Date.now() - started,
        ...result,
      });
    } catch (err) {
      console.error('Ingest failed:', err);
      sendJson(res, 500, {
        ok: false,
        error: err.message,
        type: err.name,
        elapsedMs: Date.now() - started,
      });
    } finally {
      running = false;
    }
    return;
  }

  sendJson(res, 404, {
    error: 'Not found',
    paths: ['/health', '/run', '/data/live/index.json', '/data/live/{date}.json'],
  });
});

server.listen(PORT, () => {
  console.log(`live-ingest listening on :${PORT}`);
});
