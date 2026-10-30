# KiGo saqlash va tiklash

Vercel production biznes yozuvlari MongoDB Atlas’da, yuklangan rasmlar R2da saqlanadi. Deploy va server restart ularni qayta yaratmaydi. Mahalliy/Cloudflare development D1 ishlatadi. Productionga seed, DROP TABLE yoki mahalliy bazani almashtiruvchi skript ishlatmang.

Admin → Zaxira va tiklash:

- **Zaxira yaratish**: joriy yozuvlar bazadan olinib, SHA-256 tekshiruvi bilan R2ga yoziladi.
- Muvaffaqiyatli yozish amallaridan keyin faoliyat bor paytda 15 daqiqada bir avtomatik nusxa olinadi. Bu alohida vaqt jadvali emas. Nusxa olish xatosi saqlangan biznes amalini bekor qilmaydi; oxirgi xato panelda ko‘rinadi.
- Muhim nusxalarni **Yuklash** orqali boshqa qurilma yoki saqlash xizmatiga ham oling. Nusxalar maxfiy profil va xabar ma’lumotlarini o‘z ichiga olishi mumkin; ularga kirishni cheklang.
- Tiklash faqat sayt egasi uchun. Avval farqlar ko‘rsatiladi. Standart rejim faqat yetishmayotgan yozuvlarni tiklaydi. Almashtirish rejimi zaxiradan keyin tahrirlangan qiymatlarni ham almashtiradi; yangi yozuvlarni o‘chirmaydi.
- `TIKLASH` tasdig‘idan keyin avval joriy holat zaxiralanadi. Yozuvlar 25 tadan atomik paketlarda tiklanadi. Tarmoq uzilsa, tugagan paketlar saqlanadi; farqlarni yana ochib qolganini davom ettiring.

Biznes ma’lumotlari, arxivlar, audit, media havolalari va hisob bog‘lanishlari zaxiralanadi. Kirish sessiyalari, OAuth so‘rovlari, vaqtinchalik limitlar va backup indekslari nusxaga kirmaydi. R2dagi rasm fayllari joyida saqlanadi; JSON eksport rasm fayllarining o‘zini ichiga olmaydi. Joriy dasturda R2 obyektlarini butunlay o‘chirish funksiyasi yo‘q.

Limit: 25 000 yozuv / 10 MB JSON. Bu chegaraga yaqinlashganda operator darajasida eksport va katta baza uchun alohida backup pipeline kerak. Nusxalar avtomatik o‘chirilmaydi; R2 xarajatlari va kvotalarini kuzating.

MongoDB ishlamay qolsa yoki backup indeksi yo‘qolsa, ilova ichidagi panelning o‘zi yetarli emas. Atlas backup/PITR imkoniyatlari va R2 `backups/v1/` nusxalarini tegishli ruxsat bilan tiklang. Provayder hisobingizdagi retention muddatini alohida tekshiring. Barcha tizimlarda mutlaq yo‘qolmaslik kafolati yo‘q; alohida nusxalar va davriy tiklash mashqi zarur.

Mahalliy tekshiruv: `node scripts/test-domain.mjs` haqiqiy SQLite bazasida yaratish, ruxsatlar, checksum/formati buzilgan nusxani rad etish, oldindan zaxiralash, missing/replace tiklash va yangi yozuvlarni saqlashni tekshiradi. Productionga yozmaydi.
