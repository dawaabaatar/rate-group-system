export type Slot = { id: number; opensAt: string; closesAt: string }
export type Phase = 'upcoming' | 'open' | 'closed'

/** Даалгаврын дараалал: нээгдэх цаг, тэнцвэл id-аар. */
export function orderSlots<T extends Slot>(slots: T[]): T[] {
  return [...slots].sort(
    (a, b) => Date.parse(a.opensAt) - Date.parse(b.opensAt) || a.id - b.id,
  )
}

export function phaseOf(now: Date, slot: Slot): Phase {
  if (now.getTime() < Date.parse(slot.opensAt)) return 'upcoming'
  if (now.getTime() <= Date.parse(slot.closesAt)) return 'open'
  return 'closed'
}

/** Өмнөх даалгавруудаас гүйцэтгээгүй (completed/excused биш) эхнийхийг буцаана. */
export function firstBlocker<T extends Slot>(
  ordered: T[],
  targetId: number,
  finished: ReadonlySet<number>,
): T | null {
  for (const s of ordered) {
    if (s.id === targetId) return null
    if (!finished.has(s.id)) return s
  }
  return null
}

export type SubmitCheck =
  | { ok: true; late: boolean }
  | { ok: false; reason: 'upcoming' | 'already_submitted' | 'expired' }

/**
 * Үнэлгээ илгээж болох эсэх.
 * - нээлттэй үед: дахин илгээж засаж болно
 * - хаагдсаны дараа: хараахан үнэлээгүй бол нэг удаа (late), улирал дуустал
 */
export function checkSubmit(args: {
  now: Date
  slot: Slot
  lateUntil: Date
  alreadyCompleted: boolean
}): SubmitCheck {
  const phase = phaseOf(args.now, args.slot)
  if (phase === 'upcoming') return { ok: false, reason: 'upcoming' }
  if (phase === 'open') return { ok: true, late: false }
  if (args.alreadyCompleted) return { ok: false, reason: 'already_submitted' }
  if (args.now.getTime() > args.lateUntil.getTime()) return { ok: false, reason: 'expired' }
  return { ok: true, late: true }
}
