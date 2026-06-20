'use strict';

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

/* ── State ─────────────────────────────────── */
let queue      = [];   // [{name, endsAt, setsLeft, isBreak}]
let phaseTimer = null;

/* ── Message handler ────────────────────────── */
self.addEventListener('message', e => {
  const { type, phases } = e.data || {};

  if (type === 'SCHEDULE') {
    clearTimeout(phaseTimer);
    queue = phases || [];
    showCurrent();
    scheduleNext();
  }

  if (type === 'CANCEL' || type === 'FOREGROUND') {
    clearTimeout(phaseTimer);
    queue = [];
    closeAll();
  }
});

/* ── Show notification for current phase ─────── */
function showCurrent() {
  if (!queue.length) return;
  const ph  = queue[0];
  const now = Date.now();
  const sec = Math.max(0, Math.round((ph.endsAt - now) / 1000));

  const title = `⏱ ${ph.name}`;
  const timeStr = fmt(sec);
  const roundStr = ph.setsLeft > 0
    ? `${ph.setsLeft} סיבוב${ph.setsLeft > 1 ? 'ים' : ''} נות${ph.setsLeft > 1 ? 'רים' : 'ר'}`
    : 'הסיבוב האחרון!';

  self.registration.showNotification(title, {
    body:             `${timeStr} נותרו  •  ${roundStr}`,
    tag:              'tl-timer',
    renotify:         true,
    silent:           true,
    requireInteraction: false,
  });
}

/* ── Schedule update at phase end ────────────── */
function scheduleNext() {
  if (queue.length <= 1) return;
  const delay = queue[0].endsAt - Date.now();

  if (delay <= 0) {
    queue.shift();
    showCurrent();
    scheduleNext();
    return;
  }

  phaseTimer = setTimeout(() => {
    queue.shift();
    if (queue.length === 0) {
      // All done
      closeAll();
      self.registration.showNotification('✅ Time Laps', {
        body:    'כל הסיבובים הושלמו!',
        tag:     'tl-timer',
        silent:  false,
      });
    } else {
      showCurrent();
      scheduleNext();
    }
  }, delay);
}

function closeAll() {
  self.registration.getNotifications({ tag: 'tl-timer' })
    .then(ns => ns.forEach(n => n.close()));
}

function fmt(secs) {
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

/* ── Tap notification → open app ─────────────── */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const open = list.find(c => 'focus' in c);
      if (open) return open.focus();
      return self.clients.openWindow('./');
    })
  );
});
