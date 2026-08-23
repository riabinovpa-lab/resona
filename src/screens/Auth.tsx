import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Spinner } from '@/components/ui/spinner'
import { SoftCard } from '../components/app-ui'
import { errorText, supabase } from '../lib/supabase'
import { STUDIO } from '../data'

/** Экраны до входа: у них нет доступа к store, потому что данных ещё нет. */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <SoftCard className="auth-card p-5">
        <div className="auth-brand">
          <b>Resona</b>
          <span className="tiny muted">студия голоса · {STUDIO.teacher}</span>
        </div>
        {children}
      </SoftCard>
    </div>
  )
}

export function Loading({ text = 'Загружаем студию' }: { text?: string }) {
  return (
    <Shell>
      <div className="mt-3 flex items-center gap-2 text-muted-foreground">
        <Spinner />
        <p>{text}…</p>
      </div>
    </Shell>
  )
}

export function Fatal({
  text,
  email,
  onRetry,
  onSignOut,
}: {
  text: string
  email?: string | null
  onRetry: () => void
  onSignOut?: () => void
}) {
  return (
    <Shell>
      <div className="kicker">не получилось</div>
      <p className="lede" style={{ marginTop: 8 }}>
        {text}
      </p>
      {email && <p className="tiny muted">Вошли как {email}</p>}
      <Button className="mt-3 w-full rounded-xl" onClick={onRetry}>
        Попробовать снова
      </Button>
      {onSignOut && (
        <Button variant="outline" className="mt-2 w-full rounded-xl" onClick={onSignOut}>
          Выйти
        </Button>
      )}
    </Shell>
  )
}

export function SignIn() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async () => {
    if (!supabase) return
    if (!email.trim() || !password) return setError('Нужны почта и пароль')
    if (password.length < 6) return setError('Пароль короче шести знаков')

    setBusy(true)
    setError('')
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
        if (error) throw error
        // Если в проекте включено подтверждение почты, сессии сразу не будет.
        if (!data.session) setSent(true)
      }
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <Shell>
        <div className="kicker">почти всё</div>
        <p className="lede" style={{ marginTop: 8 }}>
          Отправили письмо на {email}. Откройте ссылку из него и возвращайтесь.
        </p>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="kicker">{mode === 'in' ? 'вход' : 'новый аккаунт'}</div>
      <p className="lede" style={{ marginTop: 6 }}>
        {mode === 'in'
          ? 'Расписание, абонемент и переписка с педагогом.'
          : 'Ученику после регистрации понадобится код от педагога.'}
      </p>

      <FieldGroup className="mt-4 gap-3">
        <Field>
          <FieldLabel>почта</FieldLabel>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="adel@example.com"
          />
        </Field>
        <Field>
          <FieldLabel>пароль</FieldLabel>
          <Input
            type="password"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit()
            }}
          />
        </Field>
        {error && <FieldError>{error}</FieldError>}
      </FieldGroup>

      <Button className="mt-4 w-full rounded-xl" disabled={busy} onClick={() => void submit()}>
        {busy ? <Spinner /> : null}
        {busy ? 'Секунду…' : mode === 'in' ? 'Войти' : 'Зарегистрироваться'}
      </Button>

      <Button
        variant="outline"
        className="mt-2 w-full rounded-xl"
        onClick={() => {
          setMode(mode === 'in' ? 'up' : 'in')
          setError('')
        }}
      >
        {mode === 'in' ? 'У меня ещё нет аккаунта' : 'У меня уже есть аккаунт'}
      </Button>
    </Shell>
  )
}

/** Аккаунт есть, но он ещё не связан с карточкой ученика: нужен код от педагога. */
export function ClaimInvite({
  email,
  onClaimed,
  onSignOut,
}: {
  email: string | null
  onClaimed: (code: string) => Promise<void>
  onSignOut: () => void
}) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  return (
    <Shell>
      <div className="kicker">код от педагога</div>
      <p className="lede" style={{ marginTop: 6 }}>
        {STUDIO.teacher} заводит карточку ученика и передаёт код из шести знаков. Он нужен один раз.
      </p>

      <div className="mt-4 flex justify-center">
        <InputOTP
          maxLength={6}
          value={code}
          onChange={(value) => setCode(value.toUpperCase())}
        >
          <InputOTPGroup>
            {Array.from({ length: 6 }, (_, i) => (
              <InputOTPSlot key={i} index={i} className="h-11 w-10 text-base" />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      {error && <p className="err">{error}</p>}

      <Button
        className="mt-4 w-full rounded-xl"
        disabled={busy}
        onClick={() => {
          if (code.trim().length < 4) return setError('Код короче четырёх знаков')
          setBusy(true)
          setError('')
          onClaimed(code.trim())
            .catch((e: unknown) => setError(errorText(e)))
            .finally(() => setBusy(false))
        }}
      >
        {busy ? <Spinner /> : null}
        {busy ? 'Проверяем…' : 'Готово'}
      </Button>

      <p className="tiny muted" style={{ marginTop: 12 }}>
        Вошли как {email ?? 'неизвестно кто'}.{' '}
        <button className="link" onClick={onSignOut}>
          выйти
        </button>
      </p>
    </Shell>
  )
}
