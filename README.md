# KiGo — sport platformasi va admin panel

Claude maketining navy/yashil vizual uslubi asosida ishlaydigan React/Vinext sayti. Vercel production ma’lumotlari MongoDB’da, mahalliy/Cloudflare development esa D1’da saqlanadi. Production’da ko‘rinish uchun beshtadan demo turnir, tashkilotchi va demo fikr, shuningdek bitta demo reklama avtomatik qo‘shiladi. Demo kontent nomi va matnida belgilangan; statistika va haqiqiy reytinglarga qo‘shilmaydi.

## Ishga tushirish

Node.js 22.13+ kerak. Bu kompyuterda Node 22: `/Users/muhammad/.local/share/kigo-node/node_modules/node/bin/node`.

```sh
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_chunky_titania.sql
npm run dev -- --host 127.0.0.1 --port 3000
```

Migratsiyani faqat yangi mahalliy bazaga bir marta qo‘llang. Mahalliy D1 va Vercel MongoDB alohida. Mahalliy namuna ma’lumotlari uchun `drizzle/local-demo.sql` faylini `--local` bilan qo‘llang; production bazasiga ishlatmang.

## Login, sign-up va admin

`/login` sahifasida email va KiGo paroli bilan kirish yoki yangi hisob yaratish mumkin. Yangi hisob yaratilgach `/register`da ism, shahar, sport turi va profil rasmi to‘ldiriladi, so‘ng bosh sahifaga qaytiladi. Google OAuth production kalitlari kiritilgach yoqiladi. [Google sozlash](GOOGLE_AUTH_SETUP.md). Gmail parolingizni KiGo formasiga kiritmang. Parolli hisoblar email orqali tasdiqlanmagani uchun ularga admin huquqi berilmaydi.

Admin: `/admin`. `KIGO_ADMIN_EMAILS` server secret qiymatida sayt egasining tekshirilgan emaili konfiguratsiya qilingan. Foydalanuvchi yuborgan rol yoki header orqali admin bo‘lib bo‘lmaydi. Server sahifasi va har bir admin API so‘rovi huquqni qayta tekshiradi. Boshqa foydalanuvchilar uchun `user`, `organizer`, `admin` rollari va bloklash/faollashtirish panelda mavjud. Sayt egasini paneldan bloklab bo‘lmaydi.

Mahalliy development uchun `.dev.vars`:

```text
KIGO_ADMIN_EMAILS=owner@example.com
```

`.dev.vars` Git va ZIPga kirmaydi. Productionda secret sifatida sozlang. Production ruxsat doirasi Sites access policy bilan alohida boshqariladi; saytning avvalgi xususiy auditoriyasi saqlangan.

## Vercel deploy

Vercel build Nitro adapteri orqali `.vercel/output` serverless deployment yaratadi. Build commandni `npm run build` holida qoldiring; output directoryni qo‘lda `dist` yoki `dist/client`ga o‘zgartirmang. Vercel Node.js 22.22+ ishlatadi.

Vercel Project Settings → Environment Variables’da quyidagilarni kiriting:

- `MONGODB_URI`: MongoDB Atlas connection string. Parol ichidagi maxsus belgilar URI-encode qilingan bo‘lsin; bu qiymatni GitHub yoki chatga yubormang.
- `MONGODB_DB`: ixtiyoriy database nomi; berilmasa `kigo` ishlatiladi.
- `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`; ixtiyoriy `R2_REGION` (odatda `auto`): R2 S3-compatible fayl saqlash ulanishi. R2 bo‘lmasa, fayllar va zaxiralar MongoDB `files` collection’ida saqlanadi.
- `KIGO_ADMIN_EMAILS`, `KIGO_PUBLIC_ORIGIN`; Google login uchun `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

MongoDB’da yangi database va `records` collection birinchi so‘rovda yaratiladi, kerakli indekslar avtomatik qo‘shiladi. Cloudflare D1’dagi mavjud foydalanuvchi va turnir ma’lumotlari MongoDB’ga avtomatik ko‘chmaydi; kerak bo‘lsa alohida eksport/import qiling. Atlas Network Access va Database User ruxsatlari sozlangan bo‘lsin. Sozlamalarni saqlagach Redeploy qiling.

# Kigo_china

## Asosiy sahifalar

- `/`: e’lon qilingan turnirlar, faol reklamalar, tashkilotchilar, hamkorlar va demo yozuvlarsiz hisoblangan DB statistikasi.
- `/turnirlar`: qidiruv, shahar/sport/narx/holat filtrlari, saralash va sahifalash.
- `/turnirlar/:slug`: real ma’lumot, ariza, saqlash, QR, kalendar, qoidalar, ishtirokchilar, o‘yin natijalari, moderatsiyadan o‘tgan sharhlar.
- `/turnir-yaratish`, `/tashkilotchi-yaratish`, `/jamoa-yaratish`: bazaga yoziladigan yaratish formalari.
- `/boshqaruv/:slug`: tashkilotchi yoki admin uchun tahrirlash, arizalarni tasdiqlash/rad etish, qur’a va o‘yin hisoblari.
- `/tashkilotchilar`, `/tashkilotchilar/:slug`: katalog, demo sharhlar aniq belgilangan; reytingga faqat haqiqiy sharhlar qo‘shiladi.
- `/sportchilar`, `/sportchilar/:slug`, `/jamoalar/:slug`: real profillar, tarkib va natijadan hisoblanadigan reyting.
- `/profil`: arizalar, o‘z turnirlari, tashkilotlari, jamoalari, saqlanganlar, kiruvchi/chiquvchi xabarlar, sharhlar va profil tahriri.
- `/hamkorlik`, `/biz-haqimizda`: bazaga saqlanadigan murojaatlar; admin javobi foydalanuvchi kabinetiga boradi.
- `/shartlar`: admin kiritgan shartlar va maxfiylik matni.

## Admin panel

17 bo‘lim: umumiy ko‘rinish, turnirlar, tashkilotchilar, sportchilar, jamoalar, foydalanuvchilar, arizalar, o‘yinlar, reklamalar, hamkorlar, sharhlar, murojaatlar, xabarlar, media, faoliyat tarixi, sayt sozlamalari, zaxira va tiklash.

Yaratish/o‘qish/tahrirlash/arxivlash/tiklash, qidiruv, 30 tadan sahifalash, CSV eksport, guruhlab arxivlash, rasm yuklash, sharh moderatsiyasi, murojaatga javob, rol va hisob holati boshqaruvi. O‘zgarishlar audit tarixiga yoziladi. Optimistik versiya tekshiruvi boshqa oynadagi tahrirni bosib yuborishning oldini oladi. Saytda ishlatilayotgan rasmni avval uning havolalarini almashtirmasdan arxivlab bo‘lmaydi.

## Haqiqiy ko‘rsatkichlar

“KiGo raqamlarda” baza orqali hisoblanadi: yakunlangan turnirlar, faol hisoblar, tashkilotchilar, e’lon qilingan sport turlari. Demo yozuvlar statistikaga qo‘shilmaydi. Bo‘sh haqiqiy baza 0 ko‘rsatadi.

Reyting: faqat `finished` o‘yinlar; g‘alaba va durang ochkolari admin sozlamalaridan olinadi. Jamoa tarkibi o‘yin yaratilganda snapshot sifatida saqlanadi. Raqib profillari tanlangan o‘yinlar sportchi/jamoa reytingiga qo‘shiladi. Qo‘lda yozilgan nomlar avtomatik profil deb qabul qilinmaydi.

Qur’a: tasdiqlangan arizalar tasodifiy juftlanadi; birinchi bosqich takror yaratilmaydi. Toq sondagi ishtirokchiga bye beriladi. Keyingi bosqichlar tashkilotchi tomonidan kiritiladi.

Reklama: hero/banner/sidebar joylashuvlari, boshlanish/tugash sanasi, holat va ustuvorlik. Ko‘rish faqat reklamaning kamida 50% qismi ekranga chiqqanda qayd etiladi. Har hisob/kampaniya/kun uchun ko‘rish va bosish bir martadan hisoblanadi. Jadvaldagi ko‘rsatkichlar kunlik noyob hisoblar yig‘indisidir.

## Rasmlar

`public/media/`: asl o‘lchamda WebP va 480/960 px variantlar. Sun’iy kattalashtirish qilinmagan. Hero asl manbasi 1475×1979; turli ekranlarda mos variant tanlanadi. Banner/muqovalarda `object-fit: cover`, logotip va profillarda mos kesim ishlatiladi. Admin R2 yoki R2 sozlanmagan Vercel’da MongoDB’ga JPG/PNG/WebP (10 MB gacha) yuklaydi; server MIME, fayl imzosi, hajm va autentifikatsiyani tekshiradi.

## Hali tashqi hisob talab qiladigan xizmatlar

Vercel’da email/KiGo paroli bilan kirish ishlaydi; Google OAuth kalitlari sozlangandagina Google login yoqiladi. ChatGPT identity headerlari faqat ishonchli Sites runtime’da qabul qilinadi; ommaviy Vercel so‘rovlari bu headerlarni ishonchli deb hisoblamaydi. SMS va Telegram bot orqali tashqi xabarnomalar uchun provayder hisoblari/kalitlari berilmagan. Xabarlar ilovaning o‘z kabinetida ishlaydi.

Click/Payme merchant hisoblari berilmagan: haqiqiy pul yechilmaydi va pullik arizalar `awaiting_payment` holatida qoladi. Admin to‘lovni soxta `paid` qilib belgilay olmaydi. To‘lov provayderi va imzolangan callback integratsiyasi ulanmaguncha pullik ariza tasdiqlanmaydi.

## Tekshiruvlar

```sh
npx tsc --noEmit
node scripts/test-domain.mjs
node scripts/test-auth.mjs
node scripts/test-chatgpt-auth.mjs
node scripts/test-mongo-files.mjs
node scripts/test-api.mjs
node scripts/test-demo-content.mjs
npm run build
```

`test-domain.mjs`: haqiqiy SQLite xotira bazasida API biznes mantiqi; test chegarasida faqat identity/Worker muhitlari almashtiriladi. Productionga yozmaydi. `test-auth.mjs` va `test-chatgpt-auth.mjs`: Google OAuth/session oqimlari hamda Vercel’da identity header spoof himoyasi. `test-mongo-files.mjs`: MongoDB fayl fallbackining binary/MIME/metadata saqlashini tekshiradi. `test-api.mjs`: faqat localhost; login/admin API, sahifalar, 404 va QR tekshiruvlari. `test-demo-content.mjs`: production-only seed, idempotentlik, beshtalik va bitta reklama qoidasini tekshiradi. Production bazasida `test-api.mjs`ni ishlatmang.

`app/api/kigo/route.ts`: oddiy foydalanuvchi va tashkilotchi amallari. `app/api/admin/route.ts`: admin o‘qish va moderatsiya. `lib/record-store.ts`: MongoDB va mahalliy D1 adapteri. `lib/kigo-store.ts`: schema validatsiyasi, server huquqlari, umumiy baza funksiyalari va reyting. `db/schema.ts`/`drizzle/`: D1 sxemasi. `components/portal.tsx`: real frontend. `components/admin-panel.tsx`: admin UI. `components/entity-editor.tsx`: yaratish/tahrirlash formalari.

## Mobil va saqlash

Telefonlar uchun pastki navigatsiya, safe-area, moslashuvchan formalar, pastdan ochiladigan modal va o‘qilishi yaxshilangan kartalar qo‘shildi. Chrome 402 px emulyatorda profil formasi tekshirildi; haqiqiy qurilma sinovi alohida kerak.

[Zaxira va tiklash tartibi](BACKUP_RECOVERY.md): MongoDB + R2, avtomatik va qo‘lda nusxa, yuklash, faqat egaga ruxsatli tiklash. Auth testlari haqiqiy imzolangan JWT va mock provider tarmog‘i bilan ishlaydi; real Google OAuth hisobi bilan yakuniy test uchun kalitlar zarur.
