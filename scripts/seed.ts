/**
 * Хөгжүүлэлтийн жишээ өгөгдөл: `npm run seed`.
 * Production-д ажиллуулахгүй (багш, оюутнуудыг админ самбараас бүртгэнэ).
 * Багшийн имэйлийг SEED_TEACHER_EMAIL-ээр өгнө.
 */
import { getPayload } from 'payload'
import config from '@payload-config'

if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed in production')

const payload = await getPayload({ config })
const DAY = 24 * 60 * 60 * 1000
const at = (days: number) => new Date(Date.now() + days * DAY).toISOString()
const teacherEmail = process.env.SEED_TEACHER_EMAIL ?? 'teacher@school.edu.mn'

const mk = (email: string, name: string, role: 'student' | 'teacher' = 'student') =>
  payload.create({ collection: 'users', data: { email, name, role, active: true } })

const teacher = await mk(teacherEmail, 'Багш', 'teacher')
const students = await Promise.all(
  ['bat', 'bold', 'saran', 'tuya'].map((n) => mk(`${n}@school.edu.mn`, n[0].toUpperCase() + n.slice(1))),
)
const term = await payload.create({ collection: 'terms', data: { name: 'Намар 2026', startsOn: at(-20), endsOn: at(40) } })
for (const [i, label] of ['Оролцоо', 'Харилцаа', 'Найдвартай байдал', 'Мэдлэг, ур чадвар', 'Багаар ажиллах', 'Санаачлага'].entries()) {
  await payload.create({ collection: 'criteria', data: { term: term.id, label, position: i + 1 } })
}
const team = await payload.create({
  collection: 'teams',
  data: { term: term.id, name: 'Баг 1', leader: students[0].id, members: students.map((s) => s.id) },
})
await payload.create({ collection: 'assignments', data: { team: team.id, title: 'Даалгавар 1', opensAt: at(-14), closesAt: at(-7) } })
await payload.create({ collection: 'assignments', data: { team: team.id, title: 'Даалгавар 2', opensAt: at(-1), closesAt: at(6) } })
console.log(`Seeded. Teacher: ${teacher.email}. Students: ${students.map((s) => s.email).join(', ')}`)
process.exit(0)
