import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { LoginForm } from '@/components/LoginForm'
import { getPayloadClient } from '@/lib/http'

export default async function LoginPage() {
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: await headers() })
  if (user) redirect('/')

  return (
    <main className="login">
      <aside className="login-side">
        <strong>Багийн үнэлгээ</strong>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h1>Багийн найзуудаа үнэлж, өөрийн дундажаа хар.</h1>
          <p>Даалгавар бүрийн дараа багийн гишүүдээ 1–5 оноогоор үнэлнэ. 2 сарын турш.</p>
        </div>
        <div className="login-note">
          <span>Хэн хэдэн оноо өгснийг харагдахгүй. Зөвхөн өөрийн дундажийг харна.</span>
        </div>
      </aside>
      <div className="login-main">
        <LoginForm />
      </div>
    </main>
  )
}
