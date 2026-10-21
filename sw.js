/* عامل الخدمة: يجعل التطبيق يفتح دون إنترنت.
   - الصفحة: من الشبكة أولًا (لتصلك التحديثات)، ومن النسخة المخزنة إذا لم يتوفر اتصال أو تأخر.
   - خط Tajawal: يُحفظ بعد أول فتح متصل، ثم يُقرأ من الجهاز دائمًا.
   - لا يلمس بيانات البطولات (التخزين المحلي) إطلاقًا.
   عند تعديل الملفات مستقبلًا: غيّر رقم الإصدار أدناه ليُحدَّث المخزون القديم. */
const VERSION = 'carrom-v18';
const SHELL = VERSION + '-shell';
const FONTS = 'carrom-fonts';
const SHELL_FILES = ['./', './index.html', './manifest.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './assets/wood.webp'];

// نفس رابط الخط في index.html حرفيًا (بعد فك &amp;)
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap';

// تخزين الخط مسبقًا عند التثبيت: لا ننتظر أن تطلبه الصفحة، لأن أول فتح للتطبيق
// (خصوصًا بعد إضافته للشاشة الرئيسية) يتم قبل أن يتولى عامل الخدمة الطلبات، فلا يُحفظ الخط وقتها.
async function cacheFonts() {
  const cache = await caches.open(FONTS);
  const res = await fetch(FONT_CSS, { mode: 'cors', credentials: 'omit' });
  if (!res.ok) throw new Error('font css ' + res.status);
  const css = await res.clone().text();
  const urls = [...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)'"]+)\)/g)].map(m => m[1]))];
  if (!urls.length) throw new Error('no font files');
  await Promise.all(urls.map(async u => {
    if (await cache.match(u)) return;
    const f = await fetch(u, { mode: 'cors', credentials: 'omit' });
    if (f.ok) await cache.put(u, f);
  }));
  await cache.put(FONT_CSS, res);
  return urls.length;
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES))
    .then(() => cacheFonts().catch(() => {}))   // فشل الخط (دون إنترنت) لا يمنع تثبيت التطبيق
    .then(() => self.skipWaiting()));
});

// الصفحة تطلب التحقق من الخط عند كل فتح متصل، فيُستكمل إن نقص شيء
self.addEventListener('message', e => {
  if (e.data === 'warm-fonts') e.waitUntil(cacheFonts().catch(() => {}));
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
  return caches.open(cacheName).then(c => c.match(req, { ignoreVary: true, ignoreSearch: false }).then(hit => hit || fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
    return res;
  })));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirst(req, FONTS).catch(() => caches.match(req, { ignoreVary: true })));
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
