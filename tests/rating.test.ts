import type { Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { HttpError } from '@/lib/http'
import { assignmentResults, getRatingForm, listMyAssignments, mySummary, submitRatings, teamMatrix } from '@/lib/rating-service'
import { fullRatings, getTestPayload, resetDb, seedTeam } from './helpers'

let payload: Payload
let d: Awaited<ReturnType<typeof seedTeam>>

beforeAll(async () => {
  payload = await getTestPayload()
})
beforeEach(async () => {
  await resetDb(payload)
  d = await seedTeam(payload)
})

const mates = (self: number) => [d.leader.id, d.s1.id, d.s2.id].filter((id) => id !== self)
const cids = () => d.criteria.map((c) => c.id)
const code = async (p: Promise<unknown>) => {
  try {
    await p
    return 'ok'
  } catch (e) {
    return e instanceof HttpError ? e.code : `unexpected:${String(e)}`
  }
}

describe('gating', () => {
  it('locks later assignments until earlier ones are rated', async () => {
    const before = await listMyAssignments(payload, d.s1.id)
    expect(before[0].assignments.map((a) => a.state)).toEqual(['late', 'locked', 'locked'])

    expect(await code(getRatingForm(payload, d.s1.id, d.open.id))).toBe('previous_incomplete')
    expect(await code(submitRatings(payload, d.s1.id, d.open.id, fullRatings(mates(d.s1.id), cids())))).toBe('previous_incomplete')

    const late = await submitRatings(payload, d.s1.id, d.closed.id, fullRatings(mates(d.s1.id), cids()))
    expect(late.late).toBe(true)
    expect(await code(submitRatings(payload, d.s1.id, d.closed.id, fullRatings(mates(d.s1.id), cids())))).toBe('already_submitted')

    const after = await listMyAssignments(payload, d.s1.id)
    expect(after[0].assignments.map((a) => a.state)).toEqual(['done', 'open', 'locked'])
    expect(await code(submitRatings(payload, d.s1.id, d.open.id, fullRatings(mates(d.s1.id), cids())))).toBe('ok')
    expect(await code(submitRatings(payload, d.s1.id, d.open.id, fullRatings(mates(d.s1.id), cids(), 2)))).toBe('ok')
    expect(await code(getRatingForm(payload, d.s1.id, d.upcoming.id))).toBe('upcoming')
  })

  it('teacher can excuse a missed assignment', async () => {
    await payload.create({ collection: 'submissions', data: { assignment: d.closed.id, rater: d.s1.id, status: 'excused' } })
    expect(await code(submitRatings(payload, d.s1.id, d.open.id, fullRatings(mates(d.s1.id), cids())))).toBe('ok')
  })

  it('non-members cannot see or rate the assignment', async () => {
    expect(await code(getRatingForm(payload, d.outsider.id, d.open.id))).toBe('not_found')
    expect(await code(submitRatings(payload, d.outsider.id, d.open.id, []))).toBe('not_found')
  })
})

describe('submission validation', () => {
  beforeEach(async () => {
    await payload.create({ collection: 'submissions', data: { assignment: d.closed.id, rater: d.s1.id, status: 'excused' } })
  })
  const submit = (r: ReturnType<typeof fullRatings>) => submitRatings(payload, d.s1.id, d.open.id, r)

  it('rejects incomplete submissions', async () => {
    expect(await code(submit(fullRatings(mates(d.s1.id), cids()).slice(1)))).toBe('incomplete_ratings')
  })
  it('rejects self ratings and unknown people', async () => {
    expect(await code(submit(fullRatings([d.s1.id, d.s2.id], cids())))).toBe('invalid_ratings')
    const withOutsider = [...fullRatings(mates(d.s1.id), cids()).slice(1), { rateeId: d.outsider.id, criterionId: cids()[0], score: 3 }]
    expect(await code(submit(withOutsider))).toBe('invalid_ratings')
  })
  it('rejects duplicates and out of range scores', async () => {
    const full = fullRatings(mates(d.s1.id), cids())
    expect(await code(submit([...full, full[0]]))).toBe('invalid_ratings')
    expect(await code(submit(full.map((r, i) => (i === 0 ? { ...r, score: 6 } : r))))).toBe('invalid_ratings')
    expect(await code(submit(full.map((r, i) => (i === 0 ? { ...r, score: 2.5 } : r))))).toBe('invalid_ratings')
  })
  it('keeps previous scores when a resubmission is rejected', async () => {
    await submit(fullRatings(mates(d.s1.id), cids(), 4))
    await code(submit(fullRatings(mates(d.s1.id), cids(), 5).slice(2)))
    const form = await getRatingForm(payload, d.s1.id, d.open.id)
    expect(form.mine).toHaveLength(mates(d.s1.id).length * 5)
    expect(new Set(form.mine.map((m) => m.score))).toEqual(new Set([4]))
  })
})

describe('anonymity', () => {
  async function seedRatings(raters: number[], ratee: number, score: number, late = false) {
    for (const rater of raters) {
      for (const c of cids()) {
        await payload.create({ collection: 'ratings', data: { assignment: d.closed.id, rater, ratee, criterion: c, score, late } })
      }
    }
  }

  it('member sees only own aggregates, never rater identities', async () => {
    await seedRatings([d.leader.id, d.s2.id], d.s1.id, 4)
    const summary = await mySummary(payload, d.s1.id)
    const json = JSON.stringify(summary)
    expect(summary[0].assignments[0].result?.overall).toBe(4)
    for (const forbidden of ['rater', 'Ахлагч', 'Болд', 'leader@', 's2@', 'byRater']) expect(json).not.toContain(forbidden)
  })

  it('hides the average when fewer than MIN_RATERS rated', async () => {
    await seedRatings([d.leader.id], d.s1.id, 5)
    const summary = await mySummary(payload, d.s1.id)
    expect(summary[0].assignments[0].result).toBeNull()
    expect(summary[0].termAverage).toBeNull()
  })

  it('late ratings never change what the member sees', async () => {
    await seedRatings([d.leader.id, d.s2.id], d.s1.id, 4)
    const before = await mySummary(payload, d.s1.id)
    // Гурав дахь үнэлэгч хоцорч 1 өгөв
    await seedRatings([d.outsider.id], d.s1.id, 1, true)
    expect(await mySummary(payload, d.s1.id)).toEqual(before)
  })

  it('open assignments show nothing to members', async () => {
    for (const rater of [d.leader.id, d.s2.id]) {
      for (const c of cids()) await payload.create({ collection: 'ratings', data: { assignment: d.open.id, rater, ratee: d.s1.id, criterion: c, score: 3 } })
    }
    const summary = await mySummary(payload, d.s1.id)
    expect(summary[0].assignments.map((a) => a.id)).toEqual([d.closed.id])
  })

  it('direct Payload API access is denied to students', async () => {
    await seedRatings([d.leader.id, d.s2.id], d.s1.id, 4)
    const asStudent = d.asUser(d.s1)
    for (const collection of ['ratings', 'otps', 'sessions', 'submissions', 'assignments', 'teams'] as const) {
      await expect(payload.find({ collection, user: asStudent, overrideAccess: false })).rejects.toThrow()
    }
    const users = await payload.find({ collection: 'users', user: asStudent, overrideAccess: false })
    expect(users.docs.map((u) => u.id)).toEqual([d.s1.id])
  })

  it('database rejects self-rating and out-of-range scores', async () => {
    const bad = (rater: number, ratee: number, score: number) =>
      payload.create({ collection: 'ratings', data: { assignment: d.open.id, rater, ratee, criterion: cids()[0], score } })
    await expect(bad(d.s1.id, d.s1.id, 3)).rejects.toThrow()
    await expect(bad(d.s1.id, d.s2.id, 9)).rejects.toThrow()
  })
})

describe('leader and teacher views', () => {
  beforeEach(async () => {
    for (const rater of [d.leader.id, d.s2.id]) {
      for (const c of cids()) {
        await payload.create({
          collection: 'ratings',
          data: { assignment: d.closed.id, rater, ratee: d.s1.id, criterion: c, score: rater === d.leader.id ? 5 : 3 },
        })
      }
    }
    await payload.create({ collection: 'submissions', data: { assignment: d.closed.id, rater: d.leader.id, status: 'completed' } })
  })

  it('leader and teacher see per-rater scores and who has not submitted', async () => {
    for (const viewer of [d.leader, d.teacher]) {
      const r = await assignmentResults(payload, d.asUser(viewer), d.closed.id)
      const bat = r.members.find((m) => m.id === d.s1.id)!
      expect(bat.overall).toBe(4)
      expect(bat.byRater.map((x) => x.raterName).sort()).toEqual(['Ахлагч', 'Болд'])
      expect(r.notSubmitted.map((m) => m.id).sort()).toEqual([d.s1.id, d.s2.id].sort())
    }
  })
  it('plain members and outsiders get 404', async () => {
    for (const u of [d.s1, d.outsider]) {
      expect(await code(assignmentResults(payload, d.asUser(u), d.closed.id))).toBe('not_found')
      expect(await code(teamMatrix(payload, d.asUser(u), d.team.id))).toBe('not_found')
    }
  })
  it('team matrix has per-assignment and term averages', async () => {
    const m = await teamMatrix(payload, d.asUser(d.teacher), d.team.id)
    const bat = m.members.find((x) => x.id === d.s1.id)!
    expect(bat.perAssignment).toEqual([4, null, null])
    expect(bat.termAverage).toBe(4)
  })
})

describe('assignment states', () => {
  it('shows excused as excused, and only allows editing while the window is open', async () => {
    await payload.create({ collection: 'submissions', data: { assignment: d.closed.id, rater: d.s1.id, status: 'excused' } })
    await submitRatings(payload, d.s1.id, d.open.id, fullRatings(mates(d.s1.id), cids()))
    const [team] = await listMyAssignments(payload, d.s1.id)
    expect(team.assignments.map((a) => [a.state, a.canEdit])).toEqual([
      ['excused', false],
      ['done', true], // нээлттэй: засч болно
      ['upcoming', false],
    ])
  })

  it('a completed assignment is not editable once its window has closed', async () => {
    await submitRatings(payload, d.s1.id, d.closed.id, fullRatings(mates(d.s1.id), cids()))
    const [team] = await listMyAssignments(payload, d.s1.id)
    expect(team.assignments[0]).toMatchObject({ state: 'done', canEdit: false })
  })
})

describe('criteria count', () => {
  it('refuses to serve or accept ratings unless the term has 5 or 6 criteria', async () => {
    await payload.create({ collection: 'submissions', data: { assignment: d.closed.id, rater: d.s1.id, status: 'excused' } })
    // Админ hook-ийг тойрч буруу тохиргоог шууд DB-д дүрсэлнэ (хамгаалалтын хоёр дахь давхарга)
    const { sql } = await import('drizzle-orm')
    await payload.db.drizzle.execute(sql`DELETE FROM rating.criteria WHERE id <> ${d.criteria[0].id}`)
    expect(await code(getRatingForm(payload, d.s1.id, d.open.id))).toBe('not_configured')
    expect(await code(submitRatings(payload, d.s1.id, d.open.id, fullRatings(mates(d.s1.id), [d.criteria[0].id])))).toBe('not_configured')
  })
})

describe('admin criteria rules', () => {
  it('refuses to open an assignment for a term without 5-6 criteria', async () => {
    const term = await payload.create({ collection: 'terms', data: { name: 'Хоосон', startsOn: new Date().toISOString(), endsOn: new Date(Date.now() + 864e5).toISOString() } })
    for (let i = 1; i <= 3; i++) await payload.create({ collection: 'criteria', data: { term: term.id, label: `C${i}`, position: i } })
    const team = await payload.create({ collection: 'teams', data: { term: term.id, name: 'T', leader: d.leader.id, members: [d.leader.id, d.s1.id, d.s2.id] } })
    const data = { team: team.id, title: 'A', opensAt: new Date().toISOString(), closesAt: new Date(Date.now() + 864e5).toISOString() }
    await expect(payload.create({ collection: 'assignments', data })).rejects.toThrow(/шалгууртай/)
    for (let i = 4; i <= 5; i++) await payload.create({ collection: 'criteria', data: { term: term.id, label: `C${i}`, position: i } })
    await expect(payload.create({ collection: 'assignments', data })).resolves.toBeTruthy()
  })

  it('refuses to delete a criterion below 5 once assignments exist', async () => {
    await expect(payload.delete({ collection: 'criteria', id: d.criteria[0].id })).rejects.toThrow(/шалгууртай/)
  })
})
