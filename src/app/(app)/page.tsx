import Link from 'next/link'
import { LogoutButton } from '@/components/LogoutButton'
import { requirePageUser } from '@/lib/page-auth'
import { getPayloadClient } from '@/lib/http'
import { listMyAssignments, teamsFor, type AssignmentState } from '@/lib/rating-service'

const LABEL: Record<AssignmentState, string> = {
  open: 'Үнэлэх',
  late: 'Хоцорч үнэлэх',
  done: 'Дууссан',
  excused: 'Чөлөөлсөн',
  upcoming: 'Удахгүй',
  locked: 'Түгжээтэй',
  missed: 'Хугацаа дууссан',
}

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('mn-MN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ulaanbaatar' }).format(new Date(iso))

export default async function Home() {
  const user = await requirePageUser()
  const payload = await getPayloadClient()
  const [teams, staffTeams] = await Promise.all([listMyAssignments(payload, user.id), teamsFor(payload, user)])

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1 style={{ fontSize: 24 }}>Сайн уу, {user.name}</h1>
          <span className="muted">{user.email}</span>
        </div>
        <nav>
          <Link href="/results">Миний үр дүн</Link>
          {user.role === 'teacher' && <a href="/admin">Удирдлага</a>}
          <LogoutButton />
        </nav>
      </header>

      {teams.length === 0 && <p className="muted">Та одоогоор ямар ч багт бүртгэгдээгүй байна.</p>}
      {teams.map((team) => (
        <section key={team.teamId} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ fontSize: 20 }}>{team.teamName}</h2>
          {team.assignments.map((a) => (
            <div key={a.id} className="card">
              <div className="row">
                <strong>{a.title}</strong>
                <span className={`badge ${a.state}`}>{LABEL[a.state]}</span>
              </div>
              <span className="muted">Хаагдах: {fmt(a.closesAt)}</span>
              {a.state === 'locked' && a.blockedBy && (
                <span className="muted">Эхлээд «{a.blockedBy.title}» даалгаврыг үнэлнэ үү.</span>
              )}
              {(a.state === 'open' || a.state === 'late') && (
                <Link className="btn" href={`/rate/${a.id}`}>Үнэлэх</Link>
              )}
              {a.canEdit && <Link className="btn ghost" href={`/rate/${a.id}`}>Засах</Link>}
            </div>
          ))}
        </section>
      ))}

      {staffTeams.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 style={{ fontSize: 20 }}>{user.role === 'teacher' ? 'Бүх баг' : 'Миний удирддаг баг'}</h2>
          {staffTeams.map((t) => (
            <Link key={t.id} href={`/team/${t.id}`}>{t.name}: оноо харах</Link>
          ))}
        </section>
      )}
    </main>
  )
}
