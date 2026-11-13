'use client'

import { useRef, useState } from 'react'

type Step = 'email' | 'code'

const minutes = (s: number) => Math.max(1, Math.ceil(s / 60))

function describe(error: string, data: { retryAfter?: number; attemptsLeft?: number }): string {
  switch (error) {
    case 'invalid_domain':
      return 'Зөвхөн edu.mn төгсгөлтэй имэйл хүлээн авна. Сургуулийн хаягаараа оролдоно уу.'
    case 'mail_unavailable':
      return 'Имэйл илгээх тохиргоо хараахан хийгдээгүй байна.'
    case 'cooldown':
      return `Дахин илгээхийн өмнө ${data.retryAfter ?? 60} секунд хүлээнэ үү.`
    case 'rate_limited':
      return 'Хэт олон хүсэлт илгээлээ. Түр хүлээгээд дахин оролдоно уу.'
    case 'locked':
      return `Түр хаагдлаа. ${minutes(data.retryAfter ?? 900)} минутын дараа дахин оролдоно уу.`
    case 'invalid_code':
      return data.attemptsLeft !== undefined
        ? `Код буруу байна. ${data.attemptsLeft} оролдлого үлдсэн.`
        : 'Код буруу эсвэл хугацаа дууссан байна.'
    default:
      return 'Алдаа гарлаа. Дахин оролдоно уу.'
  }
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data: data as { error?: string; retryAfter?: number; attemptsLeft?: number } }
}

export function LoginForm() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const boxes = useRef<(HTMLInputElement | null)[]>([])

  async function requestCode() {
    setBusy(true)
    setError(null)
    const { ok, data } = await post('/api/auth/otp/request', { email })
    setBusy(false)
    if (!ok) return setError(describe(data.error ?? '', data))
    setDigits(Array(6).fill(''))
    setStep('code')
  }

  async function verify(code: string) {
    setBusy(true)
    setError(null)
    const { ok, data } = await post('/api/auth/otp/verify', { email, code })
    if (ok) {
      window.location.href = '/'
      return
    }
    setBusy(false)
    setDigits(Array(6).fill(''))
    boxes.current[0]?.focus()
    setError(describe(data.error ?? '', data))
  }

  function setDigit(i: number, value: string) {
    const clean = value.replace(/\D/g, '')
    if (clean.length > 1) {
      // buулгасан (paste) бүтэн код
      const next = clean.slice(0, 6).split('')
      setDigits(Array.from({ length: 6 }, (_, k) => next[k] ?? ''))
      if (next.length === 6) void verify(next.join(''))
      return
    }
    const next = [...digits]
    next[i] = clean
    setDigits(next)
    if (clean && i < 5) boxes.current[i + 1]?.focus()
    if (next.every(Boolean)) void verify(next.join(''))
  }

  const errorBox = error && (
    <div className="error" role="alert">
      <span>{error}</span>
    </div>
  )

  if (step === 'email') {
    return (
      <form
        className="login-form"
        onSubmit={(e) => {
          e.preventDefault()
          void requestCode()
        }}
      >
        <div>
          <h2 style={{ fontSize: 28 }}>Нэвтрэх</h2>
          <p className="muted">Сургуулийн edu.mn имэйлээ оруулна уу. Бид таны имэйл рүү нэг удаагийн код илгээнэ.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label htmlFor="email">Сургуулийн имэйл</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="нэр@school.edu.mn"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
          />
          {errorBox}
        </div>
        <button className="btn" disabled={busy || !email}>
          Код авах
        </button>
        <p className="muted">6 оронтой код илгээнэ. Код 10 минут хүчинтэй бөгөөд зөвхөн нэг удаа ашиглагдана.</p>
      </form>
    )
  }

  return (
    <form
      className="login-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (digits.every(Boolean)) void verify(digits.join(''))
      }}
    >
      <div>
        <h2 style={{ fontSize: 28 }}>Кодоо оруулна уу</h2>
        <p className="muted">
          6 оронтой кодыг <strong style={{ color: 'var(--ink)' }}>{email}</strong> хаяг руу илгээлээ.
        </p>
      </div>
      <fieldset style={{ border: 0, padding: 0 }}>
        <legend style={{ marginBottom: 12 }}>Нэг удаагийн код</legend>
        <div className="otp">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                boxes.current[i] = el
              }}
              type="text"
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={6}
              aria-label={`Цифр ${i + 1}`}
              value={d}
              autoFocus={i === 0}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !d && i > 0) boxes.current[i - 1]?.focus()
              }}
            />
          ))}
        </div>
        <div style={{ marginTop: 12 }}>{errorBox}</div>
      </fieldset>
      <button className="btn" disabled={busy || !digits.every(Boolean)}>
        Нэвтрэх
      </button>
      <div className="row muted">
        <button type="button" className="link-btn" onClick={() => { setStep('email'); setError(null) }}>
          Имэйл солих
        </button>
        <button type="button" className="link-btn" disabled={busy} onClick={() => void requestCode()}>
          Код дахин илгээх
        </button>
      </div>
    </form>
  )
}
