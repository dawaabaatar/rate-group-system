import Link from 'next/link'
import { getPayloadClient } from '@/lib/http'
import { requirePageUser } from '@/lib/page-auth'
import { mySummary } from '@/lib/rating-service'

export default async function ResultsPage() {
  const user = await requirePageUser()
  const teams = await mySummary(await getPayloadClient(), user.id)

  return (
    <main className="shell">
      <header className="topbar">
        <h1 style={{ fontSize: 24 }}>Миний үр дүн</h1>
        <Link href="/">Буцах</Link>
      </header>
      <p className="muted">Үнэлгээний хугацаа хаагдсаны дараа, хангалттай үнэлгээ ирсэн даалгаврын дундаж харагдана. Хэн хэдийг өгсөн нь харагдахгүй.</p>

      {teams.length === 0 && <p className="muted">Хараахан үр дүн байхгүй.</p>}
      {teams.map((team) => (
        <section key={team.teamName} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="row">
            <h2 style={{ fontSize: 20 }}>{team.teamName}</h2>
            <span>Улирлын дундаж: <strong>{team.termAverage ?? '–'}</strong></span>
          </div>
          {team.assignments.map((a) => (
            <div key={a.id} className="card">
              <div className="row">
                <strong>{a.title}</strong>
                <strong>{a.result ? a.result.overall : '–'}</strong>
              </div>
              {a.result ? (
                <div className="table-wrap">
                  <table>
                    <tbody>
                      {a.result.byCriterion.map((c) => (
                        <tr key={c.label}><td>{c.label}</td><td>{c.avg}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <span className="muted">Хангалттай үнэлгээ ирээгүй тул дундаж харагдахгүй.</span>
              )}
            </div>
          ))}
        </section>
      ))}
    </main>
  )
}
