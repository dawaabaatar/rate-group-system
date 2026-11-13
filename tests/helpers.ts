import config from '@payload-config'
import { sql } from 'drizzle-orm'
import { getPayload, type Payload } from 'payload'
import type { SessionUser } from '@/lib/http'

export const getTestPayload = () => getPayload({ config })

export async function resetDb(payload: Payload) {
  await payload.db.drizzle.execute(
    sql`TRUNCATE rating.ratings, rating.submissions, rating.assignments, rating.criteria, rating.teams, rating.teams_rels, rating.terms, rating.sessions, rating.otps, rating.users RESTART IDENTITY CASCADE`,
  )
}

const DAY = 24 * 60 * 60 * 1000
const at = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString()

/** Улирал: 3 гишүүнтэй баг, 5 шалгуур, багш, 3 даалгавар (хаагдсан / нээлттэй / удахгүй). */
export async function seedTeam(payload: Payload) {
  const mk = (email: string, name: string, role: 'student' | 'teacher' = 'student') =>
    payload.create({ collection: 'users', data: { email, name, role, active: true } })
  const teacher = await mk('teacher@school.edu.mn', 'Багш', 'teacher')
  const leader = await mk('leader@school.edu.mn', 'Ахлагч')
  const s1 = await mk('s1@school.edu.mn', 'Бат')
  const s2 = await mk('s2@school.edu.mn', 'Болд')
  const outsider = await mk('outsider@school.edu.mn', 'Гадны')
  const term = await payload.create({ collection: 'terms', data: { name: 'Намар', startsOn: at(-30), endsOn: at(30) } })
  const criteria = []
  for (let i = 1; i <= 5; i++) {
    criteria.push(await payload.create({ collection: 'criteria', data: { term: term.id, label: `Шалгуур ${i}`, position: i } }))
  }
  const team = await payload.create({
    collection: 'teams',
    data: { term: term.id, name: 'Баг 1', leader: leader.id, members: [leader.id, s1.id, s2.id] },
  })
  const mkA = (title: string, opens: number, closes: number) =>
    payload.create({ collection: 'assignments', data: { team: team.id, title, opensAt: at(opens), closesAt: at(closes) } })
  const closed = await mkA('Даалгавар 1', -20, -10)
  const open = await mkA('Даалгавар 2', -2, 5)
  const upcoming = await mkA('Даалгавар 3', 10, 20)

  const asUser = (u: { id: number }) => ({ ...u, collection: 'users' }) as unknown as SessionUser
  return { teacher, leader, s1, s2, outsider, term, criteria, team, closed, open, upcoming, asUser }
}

/** Бүрэн, зөв хэлбэртэй оноо: бүх хамтрагч × бүх шалгуур. */
export function fullRatings(mateIds: number[], criteriaIds: number[], score = 4) {
  return mateIds.flatMap((rateeId) => criteriaIds.map((criterionId) => ({ rateeId, criterionId, score })))
}
