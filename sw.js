
const CACHE = "milex-edu-shell-v6";
const SHELL = ["./", "./manifest.json", "./manus-routes.json", "./logo.png", "./logo-dark.png", "./favicon.png", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png", "./audit_log.html", "./dashboard.html", "./exam.html", "./exam_builder.html", "./index.html", "./manage_exams.html", "./manage_groups.html", "./parent_portal.html", "./scanner.html", "./student_delete.html", "./student_edit.html", "./student_registration.html", "./student_serch.html", "./milex.html", "./test.html", "./milex-common.js", "./milex-theme.css", "./milex-motion.js", "./milex-install.js", "./milex-download.js", "./milex-ai.js", "./logo-mark.png", "./offline.html", "./staff.html", "./receipts.html", "./backup.html", "./student_report.html", "./schedule.html", "./student_notes.html", "./honor.html", "./materials.html", "./milex-ui.js", "./milex-copilot.js", "./milex-schedule.js", "./milex-theme-sync.js", "./milex-dark.css", "./milex-pages.css"];

const CDN_HOSTS = ["cdn.jsdelivr.net", "unpkg.com", "cdnjs.cloudflare.com"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all(SHELL.map(u => cache.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (CDN_HOSTS.includes(url.hostname) && (req.destination === "script" || req.destination === "style" || url.pathname.endsWith(".js"))) {
    event.respondWith(
      caches.match(req).then(cached => {
        const net = fetch(req).then(res => {
          if (res && (res.ok || res.type === "opaque")) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
          return res;
        }).catch(() => cached);
        return cached || net;
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;
  const isDocument = req.mode === "navigate" || req.destination === "document" || url.pathname.endsWith(".html") || url.pathname.endsWith("/");
  const save = response => {
    if (response && response.ok) { const copy = response.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return response;
  };
  if (isDocument) {

    event.respondWith(fetch(req).then(save).catch(() => caches.match(req).then(r => r || caches.match("./offline.html") || caches.match("./index.html"))));
  } else {
    // Never serve HTML as a substitute for a missing JS/CSS/image asset.
    // ملفات ثابتة: من الكاش فورًا + تتحدّث في الخلفية (التحديثات توصل من غير ما نستنى رقم نسخة جديد)
    event.respondWith(caches.match(req).then(r => {
      const net = fetch(req).then(save).catch(() => r);
      return r || net;
    }));
  }
});
