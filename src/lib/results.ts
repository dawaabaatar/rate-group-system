export type RatingRow = {
  raterId: number
  rateeId: number
  criterionId: number
  score: number
  late: boolean
}

export type Summary = {
  overall: number
  byCriterion: Record<number, number>
  raters: number
}

const round2 = (n: number) => Math.round(n * 100) / 100
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

/**
 * Нэг ratee-ийн дундаж. Үнэлэгчийн тоо босгоос бага бол null (оноо ил болохоос сэргийлнэ).
 * `includeLate: false` нь гишүүний харагдах дундаж: хугацаа хаагдсаны дараах үнэлгээ
 * дундажийг өөрчилж үнэлэгчийг таах боломж олгохгүй.
 */
export function summarize(
  rows: RatingRow[],
  opts: { minRaters: number; includeLate: boolean },
): Summary | null {
  const used = opts.includeLate ? rows : rows.filter((r) => !r.late)
  const raters = new Set(used.map((r) => r.raterId))
  if (used.length === 0 || raters.size < opts.minRaters) return null

  const perCriterion = new Map<number, number[]>()
  for (const r of used) {
    const list = perCriterion.get(r.criterionId) ?? []
    list.push(r.score)
    perCriterion.set(r.criterionId, list)
  }
  const byCriterion: Record<number, number> = {}
  for (const [id, scores] of perCriterion) byCriterion[id] = round2(mean(scores))

  return {
    overall: round2(mean(used.map((r) => r.score))),
    byCriterion,
    raters: raters.size,
  }
}

/** Улирлын дундаж: харагдаж буй даалгавруудын нийт дундажуудын жигнэсэн дундаж (анхны жин 1). */
export function termAverage(items: { overall: number; weight?: number }[]): number | null {
  if (items.length === 0) return null
  const totalWeight = items.reduce((s, i) => s + (i.weight ?? 1), 0)
  const sum = items.reduce((s, i) => s + i.overall * (i.weight ?? 1), 0)
  return round2(sum / totalWeight)
}
