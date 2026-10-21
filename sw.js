/* عامل الخدمة: يجعل التطبيق يفتح دون إنترنت.
   - الصفحة: من الشبكة أولًا (لتصلك التحديثات)، ومن النسخة المخزنة إذا لم يتوفر اتصال أو تأخر.
   - خط Tajawal: يُحفظ بعد أول فتح متصل، ثم يُقرأ من الجهاز دائمًا.
   - لا يلمس بيانات البطولات (التخزين المحلي) إطلاقًا.
   عند تعديل الملفات مستقبلًا: غيّر رقم الإصدار أدناه ليُحدَّث المخزون القديم. */
const VERSION = 'carrom-v2';
const SHELL = VERSION + '-shell';
const FONTS = 'carrom-fonts';
const SHELL_FILES = ['./', './index.html', './manifest.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function networkFirst(req, timeoutMs) {
  return new Promise(resolve => {
    let settled = false;
    const fromCache = () => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'));
    const timer = setTimeout(() => { fromCache().then(r => { if (r && !settled) { settled = true; resolve(r); } }); }, timeoutMs);
    fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); }
      if (!settled) { settled = true; clearTimeout(timer); resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      fromCache().then(r => { if (!settled) { settled = true; resolve(r || Response.error()); } });
    });
  });
}

function cacheFirst(req, cacheName) {
  return caches.open(cacheName).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
    return res;
  })));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirst(req, FONTS).catch(() => caches.match(req)));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    e.respondWith(networkFirst(req, 3000));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(res => { if (res && res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});
