# Багийн үнэлгээ

Next.js + Payload 3 + Supabase Postgres. Төлөвлөгөө, аюулгүй байдлын загвар: [PLAN.md](PLAN.md).

## Локал ажиллуулах
```bash
cp .env.example .env        # DATABASE_URI, PAYLOAD_SECRET, OTP_SECRET (openssl rand -base64 48) бөглөнө
npm install
npm run migrate             # схем + RLS/хязгаарлалт
npm run seed                # (dev) жишээ багш, оюутан, баг
npm run dev                 # SMTP-гүй үед OTP код серверийн консолд хэвлэгдэнэ
npm test                    # TEST_DATABASE_URI (нэр нь `test`-ээр төгсөх ёстой) дээр ажиллана
```
Багш `/login`-оор нэвтэрсний дараа `/admin`-аас улирал, шалгуур, баг, даалгавар, хэрэглэгчийг удирдана.
Хэрэглэгч зөвхөн багш бүртгэсэн `*.edu.mn` имэйлээр нэвтэрнэ.

## Багшийн ажлын дараалал
1. Terms: улирал. 2. Criteria: 5–6 шалгуур (position 1–6). 3. Users: оюутнууд (`edu.mn` имэйл).
4. Teams: ахлагч + ≥3 гишүүн. 5. Assignments: нээгдэх/хаагдах цаг (даалгаврын дараалал = нээгдэх цаг).
Гишүүн хугацаа дууссан даалгаврыг өөрөө үнэлээгүй бол дараагийнх түгжигдэнэ: хоцорч нэг удаа үнэлэх
(улирал дуустал) эсвэл Submissions-д `excused` мөр нэмж чөлөөлнө.

## Vercel + Supabase
1. Supabase: төсөл үүсгээд Database > Connection string > **Session pooler** (5432) холболтыг авна.
2. Vercel: Environment Variables (Production, build-д ч): `DATABASE_URI`, `PAYLOAD_SECRET`, `OTP_SECRET`,
   `SERVER_URL` (https://таны-домэйн), `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM`, `MIN_RATERS` (заавал биш).
   SSL сертификатын алдаа гарвал Supabase-ийн CA-г `DATABASE_CA`-д өгнө.
3. Deploy: `vercel --prod`. Build үед `payload migrate` ажиллана (`vercel-build`).
4. Эхний багшийг Supabase SQL editor-оос нэмнэ:
   `insert into rating.users (email, name, role, active) values ('багш@сургууль.edu.mn', 'Нэр', 'teacher', true);`
   Дараа нь `/login`-оор нэвтэрч `/admin`-аас бусдыг нэмнэ.

## Аюулгүй байдлын товч
OTP: HMAC хадгалалт, 5 оролдлого (атом), 10 мин, нэг удаа, хязгаарлалт. Session: DB-д хэш, httpOnly cookie, logout-д хүчингүй.
Түүхий оноо Payload-ийн API-аар хаалттай; гишүүн зөвхөн өөрийн нийлбэрийг (≥2 үнэлэгч, хаагдсаны дараа) харна.
Бүх хүснэгтэд RLS, `rating` схем нь Supabase API-д ил биш.
