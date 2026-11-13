import { describe, expect, it } from 'vitest'
import { isEduMnEmail, normalizeEmail } from '@/lib/email'
import { checkSubmit, firstBlocker, orderSlots, phaseOf } from '@/lib/gating'
import { generateCode, hashCode, isValidCodeFormat, safeEqualHex } from '@/lib/otp'
import { summarize, termAverage, type RatingRow } from '@/lib/results'

describe('email', () => {
  it('accepts edu.mn and its subdomains', () => {
    for (const e of ['a@edu.mn', 'bat.erdene@school.edu.mn', 'x@a.b.edu.mn', 'x+1@school.edu.mn'])
      expect(isEduMnEmail(e)).toBe(true)
  })
  it('rejects look-alikes and injection attempts', () => {
    for (const e of [
      'a@gmail.com',
      'a@edu.mn.evil.com',
      'a@evil-edu.mn',
      'a@notedu.mn',
      'a b@school.edu.mn',
      'a@school.edu.mn\nbcc:x@y.com',
      'a@x.com?@school.edu.mn',
      '"a"@school.edu.mn',
      '@school.edu.mn',
    ])
      expect(isEduMnEmail(e), e).toBe(false)
  })
  it('normalizes case and whitespace', () => {
    expect(normalizeEmail('  Bat@School.EDU.mn ')).toBe('bat@school.edu.mn')
  })
})

describe('otp', () => {
  it('generates 6 digit codes', () => {
    for (let i = 0; i < 200; i++) expect(isValidCodeFormat(generateCode())).toBe(true)
  })
  it('binds the hash to email and secret', () => {
    const h = hashCode('s'.repeat(32), 'a@x.edu.mn', '123456')
    expect(safeEqualHex(h, hashCode('s'.repeat(32), 'a@x.edu.mn', '123456'))).toBe(true)
    expect(safeEqualHex(h, hashCode('s'.repeat(32), 'b@x.edu.mn', '123456'))).toBe(false)
    expect(safeEqualHex(h, hashCode('t'.repeat(32), 'a@x.edu.mn', '123456'))).toBe(false)
    expect(safeEqualHex(h, 'abcd')).toBe(false)
  })
  it('rejects malformed codes', () => {
    for (const c of ['12345', '1234567', 'abcdef', '12 456', ''] ) expect(isValidCodeFormat(c)).toBe(false)
  })
})

const row = (raterId: number, criterionId: number, score: number, late = false): RatingRow => ({
  raterId, rateeId: 1, criterionId, score, late,
})

describe('results', () => {
  it('hides the average below the rater threshold', () => {
    expect(summarize([row(2, 1, 5), row(2, 2, 4)], { minRaters: 2, includeLate: false })).toBeNull()
  })
  it('averages per criterion and overall', () => {
    const s = summarize([row(2, 1, 5), row(3, 1, 3), row(2, 2, 4), row(3, 2, 4)], { minRaters: 2, includeLate: false })!
    expect(s.byCriterion).toEqual({ 1: 4, 2: 4 })
    expect(s.overall).toBe(4)
  })
  it('excludes late ratings for the member view but not for staff', () => {
    const rows = [row(2, 1, 5), row(3, 1, 5), row(4, 1, 1, true)]
    expect(summarize(rows, { minRaters: 2, includeLate: false })!.overall).toBe(5)
    expect(summarize(rows, { minRaters: 2, includeLate: true })!.overall).toBe(3.67)
  })
  it('term average ignores hidden rounds', () => {
    expect(termAverage([{ overall: 4 }, { overall: 5 }])).toBe(4.5)
    expect(termAverage([])).toBeNull()
  })
})

const slot = (id: number, open: string, close: string) => ({ id, opensAt: open, closesAt: close })

describe('gating', () => {
  const a1 = slot(1, '2026-01-01T00:00:00Z', '2026-01-10T00:00:00Z')
  const a2 = slot(2, '2026-01-15T00:00:00Z', '2026-01-25T00:00:00Z')
  const a3 = slot(3, '2026-02-01T00:00:00Z', '2026-02-10T00:00:00Z')
  const ordered = orderSlots([a3, a1, a2])

  it('orders by open time', () => expect(ordered.map((s) => s.id)).toEqual([1, 2, 3]))
  it('blocks on the first unfinished earlier assignment', () => {
    expect(firstBlocker(ordered, 3, new Set([2]))?.id).toBe(1)
    expect(firstBlocker(ordered, 3, new Set([1, 2]))).toBeNull()
    expect(firstBlocker(ordered, 1, new Set())).toBeNull()
  })
  it('computes phases', () => {
    expect(phaseOf(new Date('2025-12-31T00:00:00Z'), a1)).toBe('upcoming')
    expect(phaseOf(new Date('2026-01-05T00:00:00Z'), a1)).toBe('open')
    expect(phaseOf(new Date('2026-01-11T00:00:00Z'), a1)).toBe('closed')
  })
  it('allows one late submission until the term ends', () => {
    const base = { slot: a1, lateUntil: new Date('2026-03-01T00:00:00Z') }
    const now = new Date('2026-01-12T00:00:00Z')
    expect(checkSubmit({ ...base, now, alreadyCompleted: false })).toEqual({ ok: true, late: true })
    expect(checkSubmit({ ...base, now, alreadyCompleted: true })).toEqual({ ok: false, reason: 'already_submitted' })
    expect(checkSubmit({ ...base, now: new Date('2026-03-02T00:00:00Z'), alreadyCompleted: false })).toEqual({ ok: false, reason: 'expired' })
    expect(checkSubmit({ ...base, now: new Date('2025-12-01T00:00:00Z'), alreadyCompleted: false })).toEqual({ ok: false, reason: 'upcoming' })
  })
  it('lets people edit while the window is open', () => {
    expect(checkSubmit({ slot: a1, lateUntil: new Date('2026-03-01T00:00:00Z'), now: new Date('2026-01-05T00:00:00Z'), alreadyCompleted: true }))
      .toEqual({ ok: true, late: false })
  })
})
