# Багийн үнэлгээний систем: төлөвлөгөө (PLAN)

Стек: **Next.js (App Router) + Payload 3 + Supabase Postgres**.
Зарчим: энгийн, цэвэр код; аюулгүй байдал эхний ээлжинд; Payload-ийн автомат REST API-аас түүхий оноо алдагдахгүй.

## 1. Хамрах хүрээ
- 2 сарын «улирал» (term). Багт олон даалгавар (assignment). Даалгавар бүр өөрийн үнэлгээний цонхтой.
- Гишүүн бүр багийнхаа бусад гишүүнийг 5–6 шалгуураар 1–5 оноогоор үнэлнэ (өөрийгөө үнэлэхгүй).
- Гишүүн зөвхөн өөрийн дундажийг (шалгуур тус бүр, нийт, улирлын дундаж) харна. Хэн хэдийг өгсөн нь харагдахгүй.
- Багийн ахлагч ба багш оноог харна.
- Нэвтрэлт: зөвхөн бүртгэлтэй `*.edu.mn` имэйл + нэг удаагийн OTP код.
- Өмнөх даалгаврыг үнэлээгүй бол дараагийнхыг үнэлэх боломжгүй.

## 2. Баримтлах шийдвэрүүд (хэрэглэгчээс батлагдаагүй, таамаглал)
| # | Асуулт | Таамаглал |
|---|---|---|
| A1 | Ахлагч/багш хэн ямар оноо өгснийг харах уу | Тийм (`byRater`). Ганцхан функцээр салгаж болно |
| A2 | Хоцорч үнэлэх | Зөвшөөрнө (нэг удаа), `late` тэмдэглэнэ. Гишүүний харагдах дундажид ороход **орохгүй** |
| A3 | Баг | Улирлын турш тогтмол. Дунд нь нэмэгдсэн гишүүнд багш өмнөх даалгаврыг `excused` болгоно |
| A4 | Гишүүн жагсаалт | Багш админ самбараар (эсвэл seed) урьдчилж бүртгэнэ. Өөрөө бүртгүүлэхгүй |

## 3. Өгөгдлийн загвар (Payload collections, схем: `rating`)
```
users        email(unique, lower), name, role[student|teacher], active
terms        name, startsOn, endsOn
teams        term, name, leader(user), members(users[])
criteria     term, label, position            (5–6 / улирал)
assignments  team, title, opensAt, closesAt   (дараалал = opensAt, дараа нь id)
submissions  assignment, rater, status[completed|excused], late, completedAt   UNIQUE(assignment, rater)
ratings      assignment, rater, ratee, criterion, score(1..5)   UNIQUE(assignment, rater, ratee, criterion)
otps         email, codeHash, expiresAt, attempts, usedAt, ip, createdAt
sessions     user, tokenHash(unique), expiresAt
```

## 4. Аюулгүй байдлын загвар
**4.1 Payload-ийн автомат API.** Collection бүр `/api/<slug>` REST/GraphQL гаргадаг. Тиймээс:
- `ratings`, `submissions`, `otps`, `sessions`: `access` бүгд `false` (`submissions` зөвхөн багш уншиж/засна). Бүх хандалт өөрийн route-оор.
- `users`: өөрийгөө эсвэл багш. Бусад collection: багш бичнэ; гишүүн зөвхөн өөрийн багийнхыг уншина.
- `access`-ийг зөвхөн UI-д биш, сервер дээр заавал шалгана.

**4.2 Supabase.** Supabase нь `public` схемийг анонимаар PostgREST-ээр нээдэг.
- Бүх хүснэгт тусдаа `rating` схемд (`schemaName`), PostgREST-д ил биш.
- Нэмэлт хамгаалалт: migration-д `ENABLE ROW LEVEL SECURITY` + `anon/authenticated`-аас эрх хураана.
- Payload `postgres` эрхээр (RLS-ийг тойрдог) серверээс л холбогдоно. `DATABASE_URI` хэзээ ч клиент рүү гарахгүй.
- Migration-оор схем удирдана (production-д `push` унтраана).

**4.3 OTP.**
- 6 орон, `crypto.randomInt`. DB-д `HMAC-SHA256(secret, email + ":" + code)` хадгална (түүхий код хэзээ ч биш).
- 10 минут хүчинтэй, нэг удаа, 5 буруу оролдлого, `timingSafeEqual`.
- Оролдлогын тоолуурыг **атомаар** нэмнэ (`UPDATE ... SET attempts = attempts + 1 WHERE attempts < 5 ... RETURNING`), зэрэг олон таамаглалаас хамгаална. Нэг удаагийн ашиглалтыг мөн `WHERE usedAt IS NULL` атомаар.
- Хүсэлтийн хязгаар: имэйл тутамд 60 сек завсар, цагт 5, IP тутамд цагт 20 (DB-ээс тоолно, Redis хэрэггүй).
- **Enumeration хамгаалалт**: бүртгэлгүй/буруу домэйн имэйлд ч адил хариу, адил мөр бичнэ. Зөвхөн бүртгэлтэй, идэвхтэй хэрэглэгчид имэйл явуулна.
- Домэйн: `^[^\s@]+@([a-z0-9-]+\.)*edu\.mn$` (нарийн regex).
- Нэвтэрсний дараа нэвтрэх цагийг урт хугацаагаар нээхгүй.

**4.4 Session.** Payload-ийн local strategy-г унтрааж (`disableLocalStrategy`), өөрийн custom strategy:
- cookie `rg_session` = санамсаргүй 32 байт, DB-д зөвхөн хэш. `httpOnly`, `secure` (prod), `sameSite=lax`, 7 хоног.
- Logout нь мөрийг устгана (шууд хүчингүй болно), JWT-ээс илүү.
- CSRF: `Origin` толгойг серверийн URL-тэй тулгана + Payload `csrf` жагсаалт.
- Admin самбар ижил cookie-г ашиглана (багш л нэвтэрнэ).

**4.5 Нэрээ нууцлах (хамгийн чухал).**
- Гишүүнд буцаах JSON-д ганц ч `rater` талбар, түүхий мөр байхгүй.
- Дундаж харуулахад **дор хаяж 2 үнэлэгч** (`MIN_RATERS`, доод хязгаар 2, тохируулж өсгөнө). 1 үнэлэгчтэй бол оноо шууд ил болно.
- Үр дүн зөвхөн үнэлгээний цонх **хаагдсан** хойно. Эс бөгөөс дундаж хөдөлж байгаад хэн өгснийг таах боломжтой.
- Цонх хаагдсаны дараах (late) үнэлгээ гишүүний харагдах дундажийг өөрчлөхгүй (өмнө/хойно харьцуулж таахаас сэргийлнэ).
- Гишүүнд «хэн үнэлсэн/үнэлээгүй» ба үнэлэгчийн тоо харагдахгүй.
- Багийн хамгийн бага хэмжээ 3 (баг үүсгэхэд шалгана).

**4.6 Бусад.** `zod`-оор бүх оролтыг шалгах; security headers (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, HSTS); алдааны мессежэд дотоод мэдээлэл гаргахгүй; prod-д OTP кодыг log-д бичихгүй; `.env` git-д ордоггүй.

## 5. Хүсэлтүүд (Next route handlers)
```
POST /api/auth/otp/request    {email}
POST /api/auth/otp/verify     {email, code}    → cookie
POST /api/auth/logout
GET  /api/me/assignments                        → миний даалгаврууд + төлөв (open|locked|done|late|upcoming)
GET  /api/assignments/:id/form                  → багийн гишүүд + шалгуурууд (gating шалгана)
PUT  /api/assignments/:id/ratings               → бүгдийг нэг транзакцаар (бүрэн байх ёстой)
GET  /api/me/summary                            → зөвхөн нийлбэр
GET  /api/assignments/:id/results               → ахлагч/багш (byRater-тэй)
```
Gating: даалгавар N-ийг үнэлэхийн тулд өөрийн багийн өмнөх бүх даалгавар `completed|excused` байх ёстой.
Хоцорсон: `closesAt`-ээс хойш `term.endsOn` хүртэл, нэг удаа.

## 6. Файлын бүтэц
```
src/payload.config.ts
src/collections/*.ts
src/lib/{env,email,otp,session,mail,guard,gating,results,db}.ts   (цэвэр логик тусдаа, тест хийхэд амар)
src/app/(app)/{login,page,rate/[id],results}/...
src/app/(app)/api/...
src/app/(payload)/...                                             (admin)
src/migrations/*
tests/*.test.ts
```

## 7. Өөрийн хяналт: эхний төлөвлөгөөнд олсон алдаанууд ба засвар
| Олдвор | Яагаад аюултай | Засвар |
|---|---|---|
| Payload `/api/ratings` нээлттэй | Түүхий оноо + үнэлэгч алдагдана | §4.1 бүх direct access хаасан |
| Supabase `public` схем ил | Анонимаар PostgREST-ээр уншина | §4.2 тусдаа схем + RLS |
| JWT/Payload `useSessions` | Логоутаар хүчингүй болдоггүй, custom login-д session-гүй | §4.4 өөрийн сессийн хүснэгт |
| `attempts` уншаад бичих | Зэрэг хүсэлтээр 5-аас олон таамаг | §4.3 атом UPDATE |
| Буруу имэйлд өөр хариу | Бүртгэлтэй хэрэглэгчийг илрүүлнэ | §4.3 ижил хариу, ижил мөр |
| 1 үнэлэгчтэй дундаж | Оноо шууд ил | §4.5 MIN_RATERS ≥ 2 |
| Хоцорсон үнэлгээ дундажийг өөрчилнө | Өмнө/хойно ялгаж үнэлэгчийг таана | §4.5 frozen харагдац |
| Үр дүнг цонх нээлттэй үед харуулах | Дундаж хөдөлгөөнөөр таана | §4.5 зөвхөн хаагдсаны дараа |
| Хэсэгчилсэн илгээлт | Gating-ийг тойрно | Бүрэн байх ёстой, нэг транзакц |
| Round + assignment тусдаа | Илүү төвөгтэй | Нэгтгэв: даалгавар өөрөө цонхтой |
| `X-Forwarded-For` хуурамч | IP хязгаар тойрогдоно | Үндсэн хязгаар имэйл тутамд; IP нь нэмэлт, платформын proxy-д л найдна |
| CSRF (cookie auth) | Гадаад сайтаас PUT | Origin шалгалт + SameSite=Lax |

## 8. Тест
- Нэгж: имэйл regex, OTP хэш/харьцуулалт, aggregation (босго, late хасалт, улирлын дундаж), gating.
- Интеграц (локал Postgres-ээр): OTP бүтэн урсгал (буруу код ×5 → түгжигдэнэ), ratings direct API 403, member summary-д `rater` байхгүй.

## 9. Хэрэгжүүлэлтийн дараалал
1. scaffold + env → 2. collections + access → 3. OTP/session → 4. ratings/gating/results → 5. UI (нэвтрэх, үнэлэх, үр дүн) → 6. migration + RLS → 7. тест → 8. README.

## 10. Сануулга (Supabase-тэй холбоотой, хэрэгжүүлэхдээ шалгана)
- Холболт: Session pooler (5432) эсвэл direct. Transaction pooler (6543) нь prepared statement-тэй зөрчилдөнө.
- Миний орчинд Supabase төсөл байхгүй: локал Postgres-ээр шалгаж, Supabase-ийн холболтыг `DATABASE_URI`-аар тохируулна. Supabase дээр бодитоор ажиллуулсан гэж мэдэгдэхгүй.

## 11. Vercel + Supabase байршуулалт
- `vercel-build` = `payload migrate && next build`: deploy бүрд migration автоматаар ажиллана (Vercel-ийн Environment Variables build үед ч хэрэгтэй).
- Хэрэгтэй хувьсагчид: `DATABASE_URI` (Supabase Session pooler 5432), `PAYLOAD_SECRET`, `OTP_SECRET`, `SERVER_URL` (production домэйн, CSRF-д ашиглагдана), `SMTP_*`, `MAIL_FROM`, `MIN_RATERS`; шаардлагатай бол `DATABASE_CA`.
- Production-д `SMTP_HOST` заавал (үгүй бол build унана). Dev-д код консолд хэвлэгдэнэ.
- Function region-ийг Supabase төслийн region-той ойр сонгоно.
- Миний өөрчлөлт: `/api/assignments` нь Payload-ийн collection endpoint-тэй мөргөлдөж admin-ийг эвдэх байсан тул `/api/me/assignments` болгов.
