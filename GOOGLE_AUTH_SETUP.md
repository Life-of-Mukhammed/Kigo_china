# KiGo Google orqali kirishni yoqish

Kod tayyor. Productionda GOOGLE_CLIENT_ID va GOOGLE_CLIENT_SECRET hali berilmagan; tugma kalitlar o‘rnatilmaguncha faol emas. Haqiqiy Google hisob bilan yakuniy kirish sinovi kalitlar qo‘shilgach bajariladi.

1. Google Cloud Console → Google Auth Platform: loyiha yarating yoki mavjud loyihani tanlang. Branding, audience va support emailni to‘ldiring. Faqat `openid`, `email`, `profile` kerak. Gmail xatlarini o‘qishga ruxsat so‘ralmaydi.
2. Web application OAuth client yarating. Authorized redirect URI aynan quyidagicha bo‘lsin:
   `https://kigo-sport-platform.dedrick-c137.chatgpt.site/auth/google/callback`
3. Sites production environment orqali quyidagilarni kiriting:
   - `GOOGLE_CLIENT_ID`: client ID.
   - `GOOGLE_CLIENT_SECRET`: secret sifatida saqlang.
   - `KIGO_PUBLIC_ORIGIN`: `https://kigo-sport-platform.dedrick-c137.chatgpt.site` (allaqachon sozlangan).
4. Shu source versiyasini yangi environment revision bilan deploy qiling. Kalitlarni chat, Git, ZIP, frontend yoki `.openai/hosting.json`ga joylamang.
5. Google consent screen testing rejimida bo‘lsa, test foydalanuvchilarini qo‘shing. Tashqi foydalanuvchilar uchun Google talablariga muvofiq publish qiling.
6. Incognito oynada `/login` → Google orqali kirish → `/register`/`/profil`ni tekshiring. Profil saqlash, qayta kirish, chiqish va admin ruxsatlarini tekshiring. Admin faqat `KIGO_ADMIN_EMAILS` server konfiguratsiyasidagi email yoki bazada berilgan rolga ega hisob bo‘ladi.

Saytning hozirgi hosting auditoriyasi xususiy. Hosting darajasidagi ChatGPT kirish talabi Google tugmasigacha saqlanadi. Ommaviy Google kirishi uchun sayt egasi auditoriyani ochishga alohida ruxsat berishi kerak; koddagi Google qo‘shilishi saytni o‘z-o‘zidan ommaviy qilmaydi.

Custom domain ishlatilsa, Google redirect URI va KIGO_PUBLIC_ORIGINni birgalikda yangilang. Mahalliy test uchun alohida Google client va localhost redirect URI ishlating; production secretlarini mahalliy testga ko‘chirmang.

Xavfsizlik: Authorization Code + PKCE, bog‘langan bir martalik state, nonce, Google RS256 imzosi/issuer/audience/expiry/email_verified tekshiruvi. Sessiya 7 kunlik HttpOnly/Secure/SameSite cookie; bazada faqat tasodifiy tokenning SHA-256 xeshi saqlanadi. Google access/refresh tokenlari saqlanmaydi. Tasdiqlangan Gmail/Workspace email mavjud profil bilan bog‘lanadi; boshqa domenli Google hisobi email orqali avtomatik birlashtirilmaydi.

Google rasmiy yo‘riqnomasi: https://developers.google.com/identity/protocols/oauth2/web-server
