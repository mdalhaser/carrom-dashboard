#!/usr/bin/env python3
"""يولّد view.html (صفحة المشاهدة) من index.html.
الاستخدام: python3 make_view.py <index.html> <view.html الحالية كمرجع للرأس> <المخرج>
يأخذ سكربت التشغيل من view.html الحالية كما هو، ويطبق الفروق الأربعة فقط:
class="view-mode" + سكربت التشغيل، العنوان، ملف manifest، اسم التطبيق على الشاشة الرئيسية."""
import sys, re
idx, ref, out = sys.argv[1:4]
s = open(idx, encoding='utf8').read()
r = open(ref, encoding='utf8').read()
H_IDX = '<html lang="ar" dir="rtl"><head>'
a = r.index('<html lang="ar" dir="rtl" class="view-mode"><head>')
b = r.index('</script>', a) + len('</script>\n')
head = r[a:b]   # ينتهي بسطر جديد؛ سطر index التالي يضيف السطر الفارغ كما في الأصل
# مفتاح تبويب الإحصائيات (v3.6) يُحفظ على جهاز اللاعب مثل بقية تفضيلات العرض
head = head.replace('|__carrom_stfold_v1)$/', '|__carrom_stfold_v1|__carrom_sttab_v1)$/')
assert '__carrom_sttab_v1' in head
reps = [
    (H_IDX, head),
    ('<title>إدارة نظام البطولة</title>', '<title>نتائج المجلس للكيرم</title>'),
    ('<link rel="manifest" href="manifest.webmanifest">', '<link rel="manifest" href="view.webmanifest">'),
    ('<meta name="apple-mobile-web-app-title" content="الكيرم">', '<meta name="apple-mobile-web-app-title" content="نتائج المجلس">'),
]
for old, new in reps:
    assert s.count(old) == 1, old
    s = s.replace(old, new)
open(out, 'w', encoding='utf8').write(s)
print('ok', out)
