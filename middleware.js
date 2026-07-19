import { next } from '@vercel/functions';

/**
 * Simple server-side password gate for the whole site.
 *
 * The password is read from the SITE_PASSWORD environment variable and is only
 * ever compared on Vercel's edge — it is never sent to the browser. Once a
 * visitor enters the correct password we set an HttpOnly cookie holding a hash
 * of the password (not the password itself), and every subsequent request is
 * checked against that hash.
 */

export const config = {
  runtime: 'edge',
  // Run on everything except the favicon so unauthenticated requests are gated.
  matcher: ['/((?!favicon.ico).*)'],
};

const COOKIE_NAME = 'nhs_aq_gate';
const COOKIE_MAX_AGE = 30 * 60; // 30-minute inactivity window

async function tokenFor(password) {
  const data = new TextEncoder().encode(`v1:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function loginPage({ error = false, notConfigured = false } = {}) {
  const message = notConfigured
    ? '<p class="note error">Site password is not configured. Set the <code>SITE_PASSWORD</code> environment variable in Vercel.</p>'
    : error
      ? '<p class="note error">Incorrect password. Please try again.</p>'
      : '<p class="note">This prototype is private. Please enter the password to continue.</p>';

  const form = notConfigured
    ? ''
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
  </style>
</head>
<body>
  <main class="card">
    <div class="brand">Air Quality · Patient Record</div>
    <h1>Private prototype</h1>
    ${message}
    ${form}
  </main>
</body>
</html>`;
}

function htmlResponse(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

export default async function middleware(request) {
  const password = process.env.SITE_PASSWORD;
  const url = new URL(request.url);

  // Clear the authentication cookie, then return to the password page.
  if (url.pathname === '/__logout') {
    return new Response(null, {
      status: 303,
      headers: {
        Location: '/',
        'Cache-Control': 'no-store',
        'Set-Cookie': `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
      },
    });
  }

  if (!password) {
    return htmlResponse(loginPage({ notConfigured: true }), 503);
  }

  const token = await tokenFor(password);

  // Handle the login form submission.
  if (request.method === 'POST' && url.pathname === '/__auth') {
    const form = await request.formData();
    const submitted = form.get('password');
    if (typeof submitted === 'string' && submitted === password) {
      return new Response(null, {
        status: 303,
        headers: {
          Location: '/?signed_in=1',
          'Cache-Control': 'no-store',
          'Set-Cookie': `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`,
        },
      });
    }
    return htmlResponse(loginPage({ error: true }), 401);
  }

  // Already authenticated?
  const cookieHeader = request.headers.get('cookie') || '';
  const authed = cookieHeader
    .split(';')
    .some((part) => part.trim() === `${COOKIE_NAME}=${token}`);

  // Active pages ping this endpoint periodically. Refreshing the cookie here
  // gives the server-side session the same rolling 30-minute inactivity limit
  // as the browser timer.
  if (url.pathname === '/__activity') {
    if (!authed) {
      return new Response(null, {
        status: 401,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    return new Response(null, {
      status: 204,
      headers: {
        'Cache-Control': 'no-store',
        'Set-Cookie': `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`,
      },
    });
  }

  if (authed) {
    return next();
  }

  return htmlResponse(loginPage(), 401);
}
