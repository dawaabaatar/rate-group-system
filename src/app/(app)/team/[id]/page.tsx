import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayloadClient, HttpError } from '@/lib/http'
import { requirePageUser } from '@/lib/page-auth'
import { assignmentResults, teamMatrix } from '@/lib/rating-service'

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser()
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) notFound()
  const payload = await getPayloadClient()

  let matrix
  try {
    matrix = await teamMatrix(payload, user, id)
  } catch (err) {
    if (err instanceof HttpError) notFound()
    throw err
  }
  const details = await Promise.all(matrix.assignments.map((a) => assignmentResults(payload, user, a.id)))

  return (
    <main className="shell">
      <header className="topbar">
        <h1 style={{ fontSize: 24 }}>{matrix.team.name}</h1>
        <Link href="/">Буцах</Link>
      </header>

      <section className="card">
        <h2 style={{ fontSize: 18 }}>Дундаж оноо</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Гишүүн</th>
                {matrix.assignments.map((a) => <th key={a.id}>{a.title}</th>)}
                <th>Улирлын дундаж</th>
              </tr>
            </thead>
            <tbody>
              {matrix.members.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  {m.perAssignment.map((v, i) => <td key={i}>{v ?? '–'}</td>)}
                  <td><strong>{m.termAverage ?? '–'}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {details.map((d) => (
        <details key={d.assignment.id} className="card">
          <summary><strong>{d.assignment.title}</strong>: хэн хэнийг үнэлсэн</summary>
          {d.notSubmitted.length > 0 && (
            <p className="muted">Үнэлээгүй: {d.notSubmitted.map((m) => m.name).join(', ')}</p>
          )}
          {d.members.map((m) => (
            <div key={m.id} className="table-wrap">
              <h3 style={{ fontSize: 16, margin: '12px 0 4px' }}>{m.name}: {m.overall ?? '–'}</h3>
              <table>
                <thead>
                  <tr>
                    <th>Үнэлсэн</th>
                    {d.criteria.map((c) => <th key={c.id}>{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {m.byRater.map((r) => (
                    <tr key={r.raterId}>
                      <td>{r.raterName}{r.late ? ' (хоцорсон)' : ''}</td>
                      {d.criteria.map((c) => <td key={c.id}>{r.scores[c.id] ?? '–'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </details>
      ))}
    </main>
  )
}
