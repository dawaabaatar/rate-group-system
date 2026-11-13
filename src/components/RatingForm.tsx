'use client'

import { useState } from 'react'

type Props = {
  assignmentId: number
  mates: { id: number; name: string }[]
  criteria: { id: number; label: string }[]
  initial: { rateeId: number; criterionId: number; score: number }[]
}

const key = (rateeId: number, criterionId: number) => `${rateeId}:${criterionId}`

const ERRORS: Record<string, string> = {
  previous_incomplete: 'Өмнөх даалгавраа эхлээд үнэлнэ үү.',
  already_submitted: 'Энэ даалгаврыг аль хэдийн үнэлсэн байна.',
  expired: 'Үнэлэх хугацаа дууссан байна. Багшид хандана уу.',
  upcoming: 'Энэ даалгавар хараахан нээгдээгүй байна.',
}

export function RatingForm({ assignmentId, mates, criteria, initial }: Props) {
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(initial.map((r) => [key(r.rateeId, r.criterionId), r.score])),
  )
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  const total = mates.length * criteria.length
  const done = Object.keys(scores).length
  const complete = done === total

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState('saving')
    setError(null)
    const ratings = mates.flatMap((m) =>
      criteria.map((c) => ({ rateeId: m.id, criterionId: c.id, score: scores[key(m.id, c.id)] })),
    )
    const res = await fetch(`/api/assignments/${assignmentId}/ratings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ratings }),
    })
    if (res.ok) {
      setState('saved')
      return
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    setState('idle')
    setError(ERRORS[data.error ?? ''] ?? 'Хадгалж чадсангүй. Дахин оролдоно уу.')
  }

  if (state === 'saved') {
    return (
      <div className="card" role="status">
        <strong>Үнэлгээ хадгалагдлаа.</strong>
        <a className="btn" href="/">Жагсаалт руу буцах</a>
      </div>
    )
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {mates.map((m) => (
        <fieldset key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <legend>{m.name}</legend>
          {criteria.map((c) => (
            <div key={c.id} role="radiogroup" aria-label={`${m.name}: ${c.label}`} className="row">
              <span>{c.label}</span>
              <div className="scale">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n}>
                    <input
                      type="radio"
                      name={key(m.id, c.id)}
                      checked={scores[key(m.id, c.id)] === n}
                      onChange={() => setScores((s) => ({ ...s, [key(m.id, c.id)]: n }))}
                    />
                    <span>{n}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
      ))}
      {error && <div className="error" role="alert">{error}</div>}
      <div className="row">
        <span className="muted">{done} / {total} онооны талбар бөглөгдсөн</span>
        <button className="btn" disabled={!complete || state === 'saving'}>Илгээх</button>
      </div>
    </form>
  )
}
