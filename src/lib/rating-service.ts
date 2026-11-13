import { commitTransaction, createLocalReq, initTransaction, killTransaction } from 'payload'
import type { Payload } from 'payload'
import type { Assignment, Team, Term } from '@/payload-types'
import { idOf } from './access'
import { MAX_CRITERIA, MIN_CRITERIA } from './criteria-rules'
import { getEnv } from './env'
import { checkSubmit, firstBlocker, orderSlots, phaseOf, type Slot } from './gating'
import { HttpError, type SessionUser } from './http'
import { summarize, termAverage, type RatingRow } from './results'

/**
 * Бүх бизнесийн логик энд. Payload Local API нь анхдагчаар `overrideAccess: true` тул
 * эрхийн шалгалтыг (гишүүн мөн үү, ахлагч/багш мөн үү) функц бүр өөрөө хийнэ.
 * Гишүүнд буцах өгөгдөлд үнэлэгчийн мэдээлэл хэзээ ч орохгүй.
 */

type Loaded = { assignment: Assignment; team: Team; term: Term; slots: (Slot & { title: string })[] }

const toSlot = (a: Assignment) => ({ id: a.id, title: a.title, opensAt: a.opensAt, closesAt: a.closesAt })
const memberIdsOf = (team: Team) => (team.members ?? []).map((m) => idOf(m)!)
const endOfDay = (iso: string) => new Date(Date.parse(iso) + 24 * 60 * 60 * 1000 - 1)

async function slotsOfTeam(payload: Payload, teamId: number) {
  const { docs } = await payload.find({
    collection: 'assignments',
    where: { team: { equals: teamId } },
    limit: 500,
    pagination: false,
    depth: 0,
  })
  return orderSlots(docs.map(toSlot))
}

async function load(payload: Payload, assignmentId: number): Promise<Loaded> {
  const assignment = await payload.findByID({ collection: 'assignments', id: assignmentId, depth: 0 }).catch(() => null)
  if (!assignment) throw new HttpError(404, 'not_found')
  const team = await payload.findByID({ collection: 'teams', id: idOf(assignment.team)!, depth: 0 })
  const term = await payload.findByID({ collection: 'terms', id: idOf(team.term)!, depth: 0 })
  return { assignment, team, term, slots: await slotsOfTeam(payload, team.id) }
}

/** Багийн гишүүн биш бол «байхгүй» гэж хариулж, оршихуйг нь ч илчлэхгүй. */
function assertMember(team: Team, userId: number) {
  if (!memberIdsOf(team).includes(userId)) throw new HttpError(404, 'not_found')
}

async function submissionStatuses(payload: Payload, userId: number, ids: number[]) {
  const map = new Map<number, 'completed' | 'excused'>()
  if (ids.length === 0) return map
  const { docs } = await payload.find({
    collection: 'submissions',
    where: { and: [{ rater: { equals: userId } }, { assignment: { in: ids } }] },
    limit: 1000,
    pagination: false,
    depth: 0,
  })
  for (const d of docs) map.set(idOf(d.assignment)!, d.status)
  return map
}

const finishedAssignmentIds = async (payload: Payload, userId: number, ids: number[]) =>
  new Set((await submissionStatuses(payload, userId, ids)).keys())

async function criteriaOf(payload: Payload, termId: number) {
  const { docs } = await payload.find({
    collection: 'criteria',
    where: { term: { equals: termId } },
    sort: 'position',
    limit: 20,
    pagination: false,
    depth: 0,
  })
  return docs.map((c) => ({ id: c.id, label: c.label }))
}

// ---------------------------------------------------------------- миний даалгаврууд

export type AssignmentState = 'done' | 'excused' | 'open' | 'late' | 'upcoming' | 'locked' | 'missed'

export async function listMyAssignments(payload: Payload, userId: number) {
  const teams = await payload.find({
    collection: 'teams',
    where: { members: { equals: userId } },
    limit: 50,
    pagination: false,
    depth: 0,
  })
  const now = new Date()
  const result = []
  for (const team of teams.docs) {
    const term = await payload.findByID({ collection: 'terms', id: idOf(team.term)!, depth: 0 })
    const slots = await slotsOfTeam(payload, team.id)
    const statuses = await submissionStatuses(payload, userId, slots.map((s) => s.id))
    const finished = new Set(statuses.keys())
    const lateUntil = endOfDay(term.endsOn)
    const items = slots.map((s) => {
      let state: AssignmentState
      let blockedBy: { id: number; title: string } | undefined
      const status = statuses.get(s.id)
      if (status === 'excused') {
        state = 'excused'
      } else if (status === 'completed') {
        state = 'done'
      } else {
        const blocker = firstBlocker(slots, s.id, finished)
        const phase = phaseOf(now, s)
        if (blocker) {
          state = 'locked'
          blockedBy = { id: blocker.id, title: blocker.title }
        } else if (phase === 'upcoming') state = 'upcoming'
        else if (phase === 'open') state = 'open'
        else state = now <= lateUntil ? 'late' : 'missed'
      }
      // Засах боломж зөвхөн үнэлгээний цонх нээлттэй байхад (хаагдсаны дараа түгжигдэнэ)
      const canEdit = state === 'done' && phaseOf(now, s) === 'open'
      return { id: s.id, title: s.title, opensAt: s.opensAt, closesAt: s.closesAt, state, blockedBy, canEdit }
    })
    result.push({ teamId: team.id, teamName: team.name, isLeader: idOf(team.leader) === userId, assignments: items })
  }
  return result
}

// ---------------------------------------------------------------- үнэлгээний хэлбэр

/** Нэг даалгаварт үнэлэхийг зөвшөөрөх эсэх: gating + хугацаа. Зөвшөөрвөл `late` буцаана. */
async function authorizeRating(payload: Payload, ctx: Loaded, userId: number) {
  const finished = await finishedAssignmentIds(payload, userId, ctx.slots.map((s) => s.id))
  const blocker = firstBlocker(ctx.slots, ctx.assignment.id, finished)
  if (blocker) throw new HttpError(409, 'previous_incomplete', { blockedBy: { id: blocker.id, title: blocker.title } })

  const check = checkSubmit({
    now: new Date(),
    slot: toSlot(ctx.assignment),
    lateUntil: endOfDay(ctx.term.endsOn),
    alreadyCompleted: finished.has(ctx.assignment.id),
  })
  if (!check.ok) throw new HttpError(409, check.reason)
  return check.late
}

export async function getRatingForm(payload: Payload, userId: number, assignmentId: number) {
  const ctx = await load(payload, assignmentId)
  assertMember(ctx.team, userId)
  const late = await authorizeRating(payload, ctx, userId)

  const mateIds = memberIdsOf(ctx.team).filter((id) => id !== userId)
  const [mates, criteria, mine] = await Promise.all([
    payload.find({ collection: 'users', where: { id: { in: mateIds } }, limit: 100, pagination: false, depth: 0 }),
    criteriaOf(payload, ctx.term.id),
    payload.find({
      collection: 'ratings',
      where: { and: [{ assignment: { equals: assignmentId } }, { rater: { equals: userId } }] },
      limit: 1000,
      pagination: false,
      depth: 0,
    }),
  ])
  if (criteria.length < MIN_CRITERIA || criteria.length > MAX_CRITERIA) throw new HttpError(409, 'not_configured')
  return {
    assignment: { id: ctx.assignment.id, title: ctx.assignment.title, closesAt: ctx.assignment.closesAt, late },
    mates: mates.docs.map((u) => ({ id: u.id, name: u.name })),
    criteria,
    // Зөвхөн өөрийн өгсөн оноо (засахад)
    mine: mine.docs.map((r) => ({ rateeId: idOf(r.ratee)!, criterionId: idOf(r.criterion)!, score: r.score })),
  }
}

export type RatingInput = { rateeId: number; criterionId: number; score: number }

export async function submitRatings(payload: Payload, userId: number, assignmentId: number, input: RatingInput[]) {
  const ctx = await load(payload, assignmentId)
  assertMember(ctx.team, userId)
  const late = await authorizeRating(payload, ctx, userId)

  const mateIds = memberIdsOf(ctx.team).filter((id) => id !== userId)
  const criteria = await criteriaOf(payload, ctx.term.id)
  if (criteria.length < MIN_CRITERIA || criteria.length > MAX_CRITERIA || mateIds.length < 2) throw new HttpError(409, 'not_configured')

  // Бүрэн, давхардалгүй: бүх хамтрагч × бүх шалгуур яг нэг удаа. Хэсэгчилсэн илгээлт gating-ийг тойрно.
  const expected = new Set(mateIds.flatMap((m) => criteria.map((c) => `${m}:${c.id}`)))
  const seen = new Set<string>()
  for (const r of input) {
    const key = `${r.rateeId}:${r.criterionId}`
    if (!expected.has(key) || seen.has(key) || !Number.isInteger(r.score) || r.score < 1 || r.score > 5) {
      throw new HttpError(400, 'invalid_ratings')
    }
    seen.add(key)
  }
  if (seen.size !== expected.size) throw new HttpError(400, 'incomplete_ratings')

  const req = await createLocalReq({}, payload)
  const ownsTx = await initTransaction(req)
  try {
    await payload.delete({
      collection: 'ratings',
      where: { and: [{ assignment: { equals: assignmentId } }, { rater: { equals: userId } }] },
      req,
    })
    for (const r of input) {
      await payload.create({
        collection: 'ratings',
        data: { assignment: assignmentId, rater: userId, ratee: r.rateeId, criterion: r.criterionId, score: r.score, late },
        req,
      })
    }
    const existing = (
      await payload.find({
        collection: 'submissions',
        where: { and: [{ assignment: { equals: assignmentId } }, { rater: { equals: userId } }] },
        limit: 1,
        depth: 0,
        req,
      })
    ).docs[0]
    const data = { status: 'completed' as const, late, completedAt: new Date().toISOString() }
    if (existing) {
      await payload.update({ collection: 'submissions', id: existing.id, data: { ...data, late: existing.late || late }, req })
    } else {
      await payload.create({ collection: 'submissions', data: { assignment: assignmentId, rater: userId, ...data }, req })
    }
    if (ownsTx) await commitTransaction(req)
  } catch (err) {
    if (ownsTx) await killTransaction(req)
    throw err
  }
  return { ok: true as const, late }
}

// ---------------------------------------------------------------- гишүүний өөрийн дундаж

const toRow = (r: { rater: unknown; ratee: unknown; criterion: unknown; score: number; late?: boolean | null }): RatingRow => ({
  raterId: idOf(r.rater)!,
  rateeId: idOf(r.ratee)!,
  criterionId: idOf(r.criterion)!,
  score: r.score,
  late: Boolean(r.late),
})

/**
 * Гишүүний өөрийн үр дүн. Үнэлэгчийн id/тоо/нэр ЯМАР Ч хэлбэрээр буцахгүй.
 * Зөвхөн хаагдсан даалгавар, хугацаанд ирсэн үнэлгээ, босгоос олон үнэлэгчтэй үед.
 */
export async function mySummary(payload: Payload, userId: number) {
  const { MIN_RATERS } = getEnv()
  const teams = await payload.find({
    collection: 'teams',
    where: { members: { equals: userId } },
    limit: 50,
    pagination: false,
    depth: 0,
  })
  const now = new Date()
  const out = []
  for (const team of teams.docs) {
    const criteria = await criteriaOf(payload, idOf(team.term)!)
    const label = new Map(criteria.map((c) => [c.id, c.label]))
    const closed = (await slotsOfTeam(payload, team.id)).filter((s) => phaseOf(now, s) === 'closed')

    const assignments = []
    for (const s of closed) {
      const { docs } = await payload.find({
        collection: 'ratings',
        where: { and: [{ assignment: { equals: s.id } }, { ratee: { equals: userId } }] },
        limit: 1000,
        pagination: false,
        depth: 0,
      })
      const sum = summarize(docs.map(toRow), { minRaters: MIN_RATERS, includeLate: false })
      assignments.push({
        id: s.id,
        title: s.title,
        result: sum && {
          overall: sum.overall,
          byCriterion: Object.entries(sum.byCriterion).map(([id, avg]) => ({ label: label.get(Number(id)) ?? '', avg })),
        },
      })
    }
    out.push({
      teamName: team.name,
      assignments,
      termAverage: termAverage(assignments.flatMap((a) => (a.result ? [{ overall: a.result.overall }] : []))),
    })
  }
  return out
}

// ---------------------------------------------------------------- ахлагч / багшийн харагдац

async function authorizeViewer(payload: Payload, user: SessionUser, teamId: number) {
  const team = await payload.findByID({ collection: 'teams', id: teamId, depth: 0 }).catch(() => null)
  if (!team || !(user.role === 'teacher' || idOf(team.leader) === user.id)) throw new HttpError(404, 'not_found')
  return team
}

async function memberNames(payload: Payload, team: Team) {
  const { docs } = await payload.find({
    collection: 'users',
    where: { id: { in: memberIdsOf(team) } },
    limit: 100,
    pagination: false,
    depth: 0,
  })
  return new Map(docs.map((u) => [u.id, u.name]))
}

/** Нэг даалгаврын дэлгэрэнгүй: хэн хэнийг хэдээр үнэлсэн (A1 таамаглал: ахлагч/багш харна). */
export async function assignmentResults(payload: Payload, user: SessionUser, assignmentId: number) {
  const assignment = await payload.findByID({ collection: 'assignments', id: assignmentId, depth: 0 }).catch(() => null)
  if (!assignment) throw new HttpError(404, 'not_found')
  const team = await authorizeViewer(payload, user, idOf(assignment.team)!)
  const [names, criteria, ratings, subs] = await Promise.all([
    memberNames(payload, team),
    criteriaOf(payload, idOf(team.term)!),
    payload.find({
      collection: 'ratings',
      where: { assignment: { equals: assignmentId } },
      limit: 5000,
      pagination: false,
      depth: 0,
    }),
    payload.find({
      collection: 'submissions',
      where: { assignment: { equals: assignmentId } },
      limit: 500,
      pagination: false,
      depth: 0,
    }),
  ])
  const rows = ratings.docs.map(toRow)
  const submitted = new Set(subs.docs.map((s) => idOf(s.rater)!))

  return {
    assignment: { id: assignment.id, title: assignment.title },
    criteria,
    members: [...names].map(([id, name]) => {
      const received = rows.filter((r) => r.rateeId === id)
      const sum = summarize(received, { minRaters: 1, includeLate: true })
      return {
        id,
        name,
        overall: sum?.overall ?? null,
        byCriterion: sum?.byCriterion ?? {},
        byRater: [...new Set(received.map((r) => r.raterId))].map((raterId) => ({
          raterId,
          raterName: names.get(raterId) ?? '',
          late: received.some((r) => r.raterId === raterId && r.late),
          scores: Object.fromEntries(received.filter((r) => r.raterId === raterId).map((r) => [r.criterionId, r.score])),
        })),
      }
    }),
    notSubmitted: [...names].filter(([id]) => !submitted.has(id)).map(([id, name]) => ({ id, name })),
  }
}

/** Багийн хүснэгт: гишүүн × даалгаврын дундаж + улирлын дундаж. */
export async function teamMatrix(payload: Payload, user: SessionUser, teamId: number) {
  const team = await authorizeViewer(payload, user, teamId)
  const [names, slots] = await Promise.all([memberNames(payload, team), slotsOfTeam(payload, team.id)])
  const { docs } = await payload.find({
    collection: 'ratings',
    where: { assignment: { in: slots.map((s) => s.id) } },
    limit: 20000,
    pagination: false,
    depth: 0,
  })
  const rows = docs.map((r) => ({ ...toRow(r), assignmentId: idOf(r.assignment)! }))

  return {
    team: { id: team.id, name: team.name },
    assignments: slots.map((s) => ({ id: s.id, title: s.title })),
    members: [...names].map(([id, name]) => {
      const perAssignment = slots.map((s) => {
        const sum = summarize(rows.filter((r) => r.assignmentId === s.id && r.rateeId === id), { minRaters: 1, includeLate: true })
        return sum?.overall ?? null
      })
      return {
        id,
        name,
        perAssignment,
        termAverage: termAverage(perAssignment.flatMap((o) => (o === null ? [] : [{ overall: o }]))),
      }
    }),
  }
}

export async function teamsFor(payload: Payload, user: SessionUser) {
  const { docs } = await payload.find({
    collection: 'teams',
    where: user.role === 'teacher' ? {} : { leader: { equals: user.id } },
    limit: 200,
    pagination: false,
    depth: 0,
  })
  return docs.map((t) => ({ id: t.id, name: t.name }))
}
