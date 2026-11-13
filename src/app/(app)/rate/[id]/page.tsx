import Link from 'next/link'
import { RatingForm } from '@/components/RatingForm'
import { getPayloadClient, HttpError } from '@/lib/http'
import { requirePageUser } from '@/lib/page-auth'
import { getRatingForm } from '@/lib/rating-service'

const MESSAGE: Record<string, string> = {
  previous_incomplete: 'Өмнөх даалгавраа эхлээд үнэлнэ үү.',
  already_submitted: 'Энэ даалгаврыг аль хэдийн үнэлсэн бөгөөд хугацаа хаагдсан тул засах боломжгүй.',
  expired: 'Үнэлэх хугацаа дууссан байна. Багшид хандана уу.',
  upcoming: 'Энэ даалгавар хараахан нээгдээгүй байна.',
  not_found: 'Даалгавар олдсонгүй.',
  not_configured: 'Үнэлгээний шалгуур хараахан тохируулагдаагүй байна.',
}

export default async function RatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser()
  const id = Number((await params).id)
  const payload = await getPayloadClient()

  let form
  try {
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, 'not_found')
    form = await getRatingForm(payload, user.id, id)
  } catch (err) {
    if (!(err instanceof HttpError)) throw err
    return (
      <main className="shell">
        <div className="card" role="alert">
          <strong>{MESSAGE[err.code] ?? 'Боломжгүй байна.'}</strong>
          <Link className="btn ghost" href="/">Буцах</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1 style={{ fontSize: 24 }}>{form.assignment.title}</h1>
          <span className="muted">Багийн гишүүн бүрийг шалгуур тус бүрээр 1–5 оноогоор үнэлнэ. Таны өгсөн оноог хэн ч харахгүй.</span>
        </div>
        <Link href="/">Буцах</Link>
      </header>
      {form.assignment.late && <p className="muted">Хугацаа хаагдсан тул хоцорч үнэлж байна. Зөвхөн нэг удаа илгээнэ.</p>}
      <RatingForm assignmentId={id} mates={form.mates} criteria={form.criteria} initial={form.mine} />
    </main>
  )
}
