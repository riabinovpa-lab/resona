import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SoftCard } from '../components/app-ui'
import { useStore } from '../store-context'

export function Feedback() {
  const { role, me, students, feedback, addFeedback } = useStore()
  const [rating, setRating] = useState(5)
  const [energy, setEnergy] = useState(4)
  const [clarity, setClarity] = useState('')
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  const items = role === 'teacher' ? feedback : feedback.filter((f) => f.studentId === me.id)

  return (
    <section>
      <h1 className="page-title">{role === 'teacher' ? 'Обратная связь' : 'Отзыв об уроке'}</h1>
      <p className="lede">
        {role === 'teacher'
          ? 'Не рейтинг ради рейтинга: что щёлкнуло на уроке и куда двигать следующий.'
          : 'Коротко после урока. Это попадает в карточку и помогает не повторять одно и то же. Вопросы и переносы — в переписке.'}
      </p>

      {role === 'student' && (
        <SoftCard className="mb-4 p-5">
          <FieldGroup className="gap-3">
            <Field>
              <FieldLabel>Как прошёл урок</FieldLabel>
              <div className="stars">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} className={n <= rating ? 'star on' : 'star'} onClick={() => setRating(n)}>
                    {n}
                  </button>
                ))}
              </div>
            </Field>
            <Field>
              <FieldLabel>Энергия после</FieldLabel>
              <div className="stars">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} className={n <= energy ? 'star on' : 'star'} onClick={() => setEnergy(n)}>
                    {n}
                  </button>
                ))}
              </div>
            </Field>
            <Field>
              <FieldLabel>Что стало яснее</FieldLabel>
              <Input value={clarity} onChange={(e) => setClarity(e.target.value)} placeholder="Одна фраза" />
            </Field>
            <Field>
              <FieldLabel>Комментарий</FieldLabel>
              <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Что оставить, что усилить, что было рано" />
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <Button
            className="mt-3.5 w-full rounded-xl"
            onClick={() => {
              if (!text.trim()) return setError('Напишите хотя бы пару строк — иначе это просто цифра')
              addFeedback({ rating, energy, clarity: clarity.trim(), text: text.trim() })
              setText('')
              setClarity('')
              setError('')
            }}
          >
            Отправить
          </Button>
        </SoftCard>
      )}

      <div className="grid">
        {items.length === 0 && <p className="empty">Отзывов пока нет.</p>}
        {items.map((f) => {
          const st = students.find((s) => s.id === f.studentId)
          return (
            <SoftCard key={f.id}>
              <div className="row">
                <strong>{role === 'teacher' ? st?.name : 'Вы'}</strong>
                <span className="tiny muted">{new Date(f.createdAt).toLocaleDateString('ru-RU')}</span>
              </div>
              <p className="tiny muted" style={{ marginTop: 6 }}>урок {f.rating}/5 · энергия {f.energy}/5</p>
              {f.clarity && <p style={{ marginTop: 8 }}>{f.clarity}</p>}
              <p className="tiny" style={{ marginTop: 8, color: 'var(--cream-dim)' }}>{f.text}</p>
            </SoftCard>
          )
        })}
      </div>
    </section>
  )
}
