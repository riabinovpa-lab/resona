import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SoftCard, StatusBadge } from '../components/app-ui'
import { useStore } from '../store-context'

export function Notices() {
  const { role, notices, students, sendNotice, markSeen, seenNoticesAt } = useStore()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  // Снимок на момент входа: иначе пометка «новое» исчезнет в тот же кадр.
  const [seenAt] = useState(seenNoticesAt)

  useEffect(() => {
    markSeen('notices')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section>
      <h1 className="page-title">{role === 'teacher' ? 'Рассылка' : 'Объявления'}</h1>
      <p className="lede">
        {role === 'teacher'
          ? `Одно сообщение уходит всем ученикам сразу — сейчас их ${students.length}. Ответы придут в личную переписку.`
          : 'Объявления студии. Ответить можно в личной переписке.'}
      </p>

      {role === 'teacher' && (
        <SoftCard className="mb-4 p-5">
          <FieldGroup className="gap-3">
            <Field>
              <FieldLabel>заголовок</FieldLabel>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Перенос, квартирник, каникулы"
              />
            </Field>
            <Field>
              <FieldLabel>текст всем</FieldLabel>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} />
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <Button
            className="mt-3 w-full rounded-xl"
            onClick={() => {
              if (!title.trim()) return setError('Нужен заголовок')
              if (!body.trim()) return setError('Пустое объявление рассылать незачем')
              sendNotice(title.trim(), body.trim())
              setTitle('')
              setBody('')
              setError('')
            }}
          >
            Разослать {students.length} ученикам
          </Button>
        </SoftCard>
      )}

      <div className="grid">
        {notices.length === 0 && <p className="empty">Объявлений пока не было.</p>}
        {notices.map((n) => {
          const fresh = role === 'student' && new Date(n.createdAt) > new Date(seenAt)
          return (
            <SoftCard key={n.id} variant={fresh ? 'alert' : 'default'}>
              <div className="row">
                <span className="kicker" style={{ margin: 0 }}>
                  {new Date(n.createdAt).toLocaleString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {fresh && <StatusBadge tone="ok">новое</StatusBadge>}
              </div>
              <strong style={{ display: 'block', marginTop: 8 }}>{n.title}</strong>
              <p style={{ marginTop: 8, color: 'var(--cream-dim)' }}>{n.body}</p>
            </SoftCard>
          )
        })}
      </div>
    </section>
  )
}
