/* عامل الخدمة: يجعل التطبيق يفتح دون إنترنت.
   - الصفحة: من الشبكة أولًا (لتصلك التحديثات)، ومن النسخة المخزنة إذا لم يتوفر اتصال أو تأخر.
   - خط Tajawal: ملفات محلية في assets/fonts ضمن ملفات التطبيق المحفوظة (لا يعتمد على Google Fonts).
   - لا يلمس بيانات البطولات (التخزين المحلي) إطلاقًا.
   - data.json (صفحة المشاهدة للاعبين): من الشبكة دائمًا، والمخزن عند انقطاع الإنترنت.
   عند تعديل الملفات مستقبلًا: غيّر رقم الإصدار أدناه ليُحدَّث المخزون القديم. */
const VERSION = 'carrom-v4.8';
const SHELL = VERSION + '-shell';
const FONTS = 'carrom-fonts';
const SHELL_FILES = ['./', './index.html', './manifest.webmanifest', './view.html', './view.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './assets/wood.webp',
  './assets/fonts/Tajawal-Regular.woff', './assets/fonts/Tajawal-Medium.woff', './assets/fonts/Tajawal-Bold.woff', './assets/fonts/Tajawal-ExtraBold.woff', './assets/fonts/Tajawal-Black.woff'];

// نفس رابط الخط في index.html حرفيًا (بعد فك &amp;)
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap';

// تخزين الخط مسبقًا عند التثبيت: لا ننتظر أن تطلبه الصفحة، لأن أول فتح للتطبيق
// (خصوصًا بعد إضافته للشاشة الرئيسية) يتم قبل أن يتولى عامل الخدمة الطلبات، فلا يُحفظ الخط وقتها.
async function cacheFonts() { return 0; }   // الخط أصبح محليًا ضمن SHELL_FILES (أُبقيت الدالة لرسالة warm-fonts القديمة)

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
  // بيانات صفحة المشاهدة: من الشبكة دائمًا (آخر نشر)، والنسخة المخزنة عند انقطاع الإنترنت فقط
  if (url.pathname.endsWith('/data.json')) {
    e.respondWith(fetch(req, { cache: 'no-store' }).then(res => { if (res && res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put('./data.json', copy)); } return res; })
      .catch(() => caches.match('./data.json')));
    return;
  }
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    e.respondWith(networkFirst(req, 3000));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(res => { if (res && res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});
