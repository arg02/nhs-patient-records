"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const querystring = require("querystring");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { GoogleAuth } = require("google-auth-library");

const sitePassword = defineSecret("SITE_PASSWORD");

// Firebase Hosting → Cloud Run (Functions v2) forwards only the __session cookie on
// GET rewrites.
const COOKIE_NAME = "__session";
const COOKIE_MAX_AGE = 30 * 60; // 30-minute inactivity window
const SITE_VERSION = "v2026.08.14-ci1";
const HOSTING_PAGES = path.join(__dirname, "hosting-pages");
const LIVE_INGEST_URL =
  process.env.LIVE_INGEST_URL ||
  "https://live-ingest-401361224018.europe-west2.run.app";

function tokenFor(password) {
  return crypto.createHash("sha256").update(`v1:${password}`, "utf8").digest("hex");
}

function loginPage({ error = false, notConfigured = false } = {}) {
  const message = notConfigured
    ? '<p class="note error">Site password is not configured. Set the <code>SITE_PASSWORD</code> secret in Secret Manager and redeploy Functions.</p>'
    : error
      ? '<p class="note error">Incorrect password. Please try again.</p>'
      : '<p class="note">This prototype is private. Please enter the password to continue.</p>';

  const form = notConfigured
    ? ""
    : `<form method="POST" action="/__auth" autocomplete="off">
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autofocus required />
        <button type="submit">Enter</button>
      </form>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex" />
  <title>Air Quality Patient Record — Private</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #e4e7ec;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #2a3142;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #fff;
      border: 1px solid #c8d0dc;
      border-radius: 12px;
      box-shadow: 0 6px 24px rgba(20, 58, 94, 0.12);
      padding: 32px 28px;
      width: 100%;
      max-width: 360px;
    }
    .brand {
      font-size: 12px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #1a4a78;
      font-weight: 700;
      margin-bottom: 14px;
    }
    h1 { font-size: 19px; font-weight: 600; color: #1a2030; margin-bottom: 8px; }
    .note { font-size: 13px; color: #6a7385; line-height: 1.5; margin-bottom: 20px; }
    .note.error { color: #a12622; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
    label { display: block; font-size: 12px; font-weight: 600; color: #4a5568; margin-bottom: 6px; }
    input {
      width: 100%;
      font-size: 15px;
      padding: 11px 12px;
      border: 1px solid #c8d0dc;
      border-radius: 8px;
      margin-bottom: 16px;
    }
    input:focus { outline: none; border-color: #1a4a78; box-shadow: 0 0 0 3px rgba(26, 74, 120, 0.15); }
    button {
      width: 100%;
      font-size: 15px;
      font-weight: 600;
      color: #fff;
      background: #1a4a78;
      border: none;
      border-radius: 8px;
      padding: 11px 12px;
      cursor: pointer;
    }
    button:hover { background: #143a5e; }
    .site-version {
      position: fixed;
      bottom: 10px;
      left: 12px;
      font-size: 11px;
      color: #9aa3b2;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="brand">Air Quality · Patient Record</div>
    <h1>Private prototype</h1>
    ${message}
    ${form}
  </main>
  <p class="site-version" aria-hidden="true">${SITE_VERSION}</p>
</body>
</html>`;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    out[key] = value;
  }
  return out;
}

function cookieHeader(token, maxAge) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearCookieHeader() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function requestPath(req) {
  const raw = req.originalUrl || req.url || req.path || "";
  try {
    return new URL(raw, "https://nhs-patient-records.web.app").pathname;
  } catch {
    return String(raw).split("?")[0];
  }
}

function requestQuery(req) {
  const raw = req.originalUrl || req.url || "";
  const idx = raw.indexOf("?");
  return idx === -1 ? "" : raw.slice(idx + 1);
}

function isAuthed(req, token) {
  const cookies = parseCookies(req.get("cookie") || req.headers.cookie || "");
  return cookies[COOKIE_NAME] === token;
}

function htmlResponse(res, body, status = 200, extraHeaders = {}) {
  res.status(status);
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store");
  for (const [key, value] of Object.entries(extraHeaders)) {
    res.set(key, value);
  }
  res.send(body);
}

function readFormBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
      resolve(req.body);
      return;
    }
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 8192) reject(new Error("body_too_large"));
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      const ct = String(req.headers["content-type"] || "");
      if (ct.includes("application/x-www-form-urlencoded")) {
        resolve(querystring.parse(raw));
        return;
      }
      resolve({});
    });
    req.on("error", reject);
  });
}

function resolveHtmlPath(pathname) {
  if (pathname === "/" || pathname === "") {
    return path.join(HOSTING_PAGES, "index.html");
  }
  if (!pathname.endsWith(".html")) {
    return null;
  }
  const base = path.basename(pathname);
  if (base !== pathname.slice(1)) {
    return null;
  }
  return path.join(HOSTING_PAGES, base);
}

function serveHtmlPage(res, pathname) {
  const filePath = resolveHtmlPath(pathname);
  if (!filePath || !fs.existsSync(filePath)) {
    res.status(404);
    res.set("Cache-Control", "no-store");
    res.set("Content-Type", "text/plain; charset=utf-8");
    res.send("Not found");
    return;
  }
  res.status(200);
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(fs.readFileSync(filePath, "utf8"));
}

let runAuthClientPromise = null;

function getRunAuthClient() {
  if (!runAuthClientPromise) {
    runAuthClientPromise = new GoogleAuth().getIdTokenClient(LIVE_INGEST_URL);
  }
  return runAuthClientPromise;
}

async function proxyLiveData(req, res, pathname) {
  const query = requestQuery(req);
  const target = `${LIVE_INGEST_URL}${pathname}${query ? `?${query}` : ""}`;
  try {
    const client = await getRunAuthClient();
    const upstream = await client.request({
      url: target,
      method: req.method || "GET",
      responseType: "text",
      validateStatus: () => true,
    });
    res.status(upstream.status);
    res.set("Cache-Control", "no-store");
    const contentType = upstream.headers["content-type"];
    if (contentType) res.set("Content-Type", contentType);
    res.send(upstream.data);
  } catch (err) {
    console.error("proxyLiveData error", err);
    res.status(502);
    res.set("Cache-Control", "no-store");
    res.set("Content-Type", "application/json; charset=utf-8");
    res.send(JSON.stringify({ ok: false, error: "live_data_unavailable" }));
  }
}

exports.siteGate = onRequest(
  {
    region: "europe-west2",
    secrets: [sitePassword],
    invoker: "public",
    cors: false,
  },
  async (req, res) => {
    res.set("Cache-Control", "no-store, max-age=0");
    res.set("Vary", "Cookie");

    const pathname = requestPath(req);
    const password = (sitePassword.value() || "").trim();

    if (pathname === "/__logout") {
      res.status(303);
      res.set("Location", "/");
      res.set("Set-Cookie", clearCookieHeader());
      res.end();
      return;
    }

    if (!password) {
      htmlResponse(res, loginPage({ notConfigured: true }), 503);
      return;
    }

    const token = tokenFor(password);
    const authed = isAuthed(req, token);

    if (req.method === "POST" && pathname === "/__auth") {
      try {
        const form = await readFormBody(req);
        const submitted = form.password;
        if (typeof submitted === "string" && submitted === password) {
          res.status(303);
          res.set("Location", "/?signed_in=1");
          res.set("Set-Cookie", cookieHeader(token, COOKIE_MAX_AGE));
          res.end();
          return;
        }
        htmlResponse(res, loginPage({ error: true }), 401);
      } catch (err) {
        console.error("__auth error", err);
        htmlResponse(res, loginPage({ error: true }), 400);
      }
      return;
    }

    if (pathname === "/__activity") {
      if (!authed) {
        res.status(401);
        res.set("Cache-Control", "no-store");
        res.end();
        return;
      }
      res.status(204);
      res.set("Cache-Control", "no-store");
      res.set("Set-Cookie", cookieHeader(token, COOKIE_MAX_AGE));
      res.end();
      return;
    }

    if (pathname.startsWith("/data/live/")) {
      if (!authed) {
        res.status(401);
        res.set("Cache-Control", "no-store");
        res.set("Content-Type", "application/json; charset=utf-8");
        res.send(JSON.stringify({ ok: false, error: "unauthorized" }));
        return;
      }
      await proxyLiveData(req, res, pathname);
      return;
    }

    const htmlPath = resolveHtmlPath(pathname);
    if (htmlPath) {
      if (!authed) {
        htmlResponse(res, loginPage(), 401);
        return;
      }
      serveHtmlPage(res, pathname);
      return;
    }

    res.status(404);
    res.set("Cache-Control", "no-store");
    res.set("Content-Type", "text/plain; charset=utf-8");
    res.send("Not found");
  }
);
