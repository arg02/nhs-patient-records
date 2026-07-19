const WARNING_AFTER_MS = 25 * 60 * 1000;
const LOGOUT_AFTER_MS = 30 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 60 * 1000;
const CHECK_INTERVAL_MS = 1000;
const ACTIVITY_KEY = 'nhs_aq_last_activity';

let lastHeartbeat = 0;
let warningVisible = false;

const query = new URLSearchParams(window.location.search);
const justSignedIn = query.get('signed_in') === '1';

function storedLastActivity() {
  const stored = Number(localStorage.getItem(ACTIVITY_KEY));
  return Number.isFinite(stored) && stored > 0 ? stored : Date.now();
}

function recordActivity() {
  const now = Date.now();
  localStorage.setItem(ACTIVITY_KEY, String(now));
  hideWarning();

  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
    refreshSession();
  }
}

async function refreshSession() {
  lastHeartbeat = Date.now();
  try {
    const response = await fetch('/__activity', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok) {
      window.location.replace('/__logout');
    }
  } catch {
    // A temporary network failure should not immediately sign the user out.
    // The local inactivity deadline and the server-side cookie still apply.
  }
}

function formatRemaining(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function showWarning(remaining) {
  const dialog = document.getElementById('inactivity-dialog');
  const countdown = document.getElementById('inactivity-countdown');
  if (!dialog || !countdown) return;

  countdown.textContent = formatRemaining(remaining);
  if (!warningVisible) {
    warningVisible = true;
    dialog.hidden = false;
    document.body.classList.add('inactivity-warning-open');
    document.getElementById('inactivity-stay-active')?.focus();
  }
}

function hideWarning() {
  if (!warningVisible) return;
  warningVisible = false;
  document.getElementById('inactivity-dialog')?.setAttribute('hidden', '');
  document.body.classList.remove('inactivity-warning-open');
}

function checkInactivity() {
  const inactiveFor = Date.now() - storedLastActivity();
  const remaining = LOGOUT_AFTER_MS - inactiveFor;

  if (remaining <= 0) {
    window.location.replace('/__logout');
    return;
  }

  if (inactiveFor >= WARNING_AFTER_MS) {
    showWarning(remaining);
  } else {
    hideWarning();
  }
}

function mountWarning() {
  const wrapper = document.createElement('div');
  wrapper.id = 'inactivity-dialog';
  wrapper.className = 'inactivity-dialog';
  wrapper.hidden = true;
  wrapper.setAttribute('role', 'dialog');
  wrapper.setAttribute('aria-modal', 'true');
  wrapper.setAttribute('aria-labelledby', 'inactivity-title');
  wrapper.innerHTML = `
    <div class="inactivity-dialog__backdrop"></div>
    <div class="inactivity-dialog__card">
      <div class="inactivity-dialog__eyebrow">Session timeout</div>
      <h2 id="inactivity-title">Are you still there?</h2>
      <p>You have been inactive for a while. For privacy, you will be signed out in:</p>
      <div id="inactivity-countdown" class="inactivity-dialog__countdown" aria-live="polite">5:00</div>
      <button id="inactivity-stay-active" type="button">Stay signed in</button>
    </div>
  `;
  document.body.appendChild(wrapper);
  document.getElementById('inactivity-stay-active')?.addEventListener('click', recordActivity);
}

if (justSignedIn) {
  localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
  query.delete('signed_in');
  const cleanQuery = query.toString();
  const cleanUrl = `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ''}${window.location.hash}`;
  window.history.replaceState({}, '', cleanUrl);
} else if (!localStorage.getItem(ACTIVITY_KEY)) {
  localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
}

mountWarning();
refreshSession();

const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
let lastRecordedEvent = 0;
for (const eventName of activityEvents) {
  window.addEventListener(eventName, () => {
    // While the warning is open, require the explicit button rather than
    // treating an incidental mouse movement as consent to stay signed in.
    if (warningVisible) return;
    const now = Date.now();
    if (now - lastRecordedEvent < 1000) return;
    lastRecordedEvent = now;
    recordActivity();
  }, { passive: true });
}

window.addEventListener('focus', checkInactivity);
window.addEventListener('storage', (event) => {
  if (event.key === ACTIVITY_KEY) checkInactivity();
});

setInterval(checkInactivity, CHECK_INTERVAL_MS);
checkInactivity();
