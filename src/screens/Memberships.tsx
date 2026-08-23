import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Initials, SoftCard, StatusBadge, paymentTone } from '../components/app-ui'
import { useStore } from '../store-context'
import { formatMoney, paymentLabel } from '../lib/format'
import type { PaymentStatus, Student } from '../types'

export function Memberships() {
  const { role } = useStore()
  return role === 'teacher' ? <StudentList /> : <MyPlan />
}

function StudentList() {
  const { students, plans, openStudent, addStudent } = useStore()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [voice, setVoice] = useState('меццо')
  const [city, setCity] = useState('Санкт-Петербург')
  const [planId, setPlanId] = useState(plans[2]?.id ?? 'pack8')
  const [goal, setGoal] = useState('')
  const [error, setError] = useState('')

  const q = query.trim().toLowerCase()
  const list = q
    ? students.filter((s) => `${s.name} ${s.voice} ${s.city}`.toLowerCase().includes(q))
    : students

  return (
    <section>
      <h1 className="page-title">Ученики</h1>
      <p className="lede">Абонемент, дневник, план и домашние — внутри карточки.</p>

      <Input
        className="mb-3"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск по имени или голосу"
      />

      <SoftCard>
        {list.length === 0 && <p className="empty">Никого не нашлось по запросу «{query}».</p>}
        {list.map((s) => {
          const plan = plans.find((p) => p.id === s.planId)
          return (
            <button key={s.id} className="cell" onClick={() => openStudent(s.id)}>
              <Initials text={s.short} />
              <div className="grow">
                <div className="title">{s.name}</div>
                <div className="sub">
                  {s.voice} · {plan?.title} · осталось {s.remaining}
                  {s.inviteCode && ` · код ${s.inviteCode}`}
                </div>
              </div>
              <StatusBadge tone={paymentTone(s.payment)}>{paymentLabel(s.payment)}</StatusBadge>
            </button>
          )
        })}
      </SoftCard>

      <Button className="mt-3.5 rounded-xl" onClick={() => setOpen((v) => !v)}>
        {open ? 'Скрыть форму' : 'Добавить ученика'}
      </Button>

      {open && (
        <SoftCard className="mt-3 p-5">
          <FieldGroup className="gap-3">
            <Field>
              <FieldLabel>имя</FieldLabel>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя Фамилия" />
            </Field>
            <div className="grid-2">
              <Field>
                <FieldLabel>голос</FieldLabel>
                <Input value={voice} onChange={(e) => setVoice(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>город</FieldLabel>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </Field>
            </div>
            <Field>
              <FieldLabel>абонемент</FieldLabel>
              <select className="search" value={planId} onChange={(e) => setPlanId(e.target.value)}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel>цель на ближайший месяц</FieldLabel>
              <Textarea value={goal} onChange={(e) => setGoal(e.target.value)} />
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <Button
            className="mt-3.5 w-full rounded-xl"
            onClick={() => {
              if (!name.trim()) return setError('Без имени карточку не завести')
              addStudent({ name: name.trim(), voice, city, planId, nextGoal: goal.trim() })
              setName('')
              setGoal('')
              setError('')
              setOpen(false)
            }}
          >
            Сохранить ученика
          </Button>
        </SoftCard>
      )}

      <div className="section-h">
        <h3>Прайс студии</h3>
      </div>
      <Plans />
    </section>
  )
}

function MyPlan() {
  const { me, plans } = useStore()
  const plan = plans.find((p) => p.id === me.planId)
  return (
    <section>
      <h1 className="page-title">Абонемент</h1>
      <p className="lede">Счётчик считает живые уроки. Пропуск по вашей вине тоже списывается.</p>
      <SoftCard className="p-5">
        <div className="row">
          <div>
            <div className="kicker">сейчас</div>
            <h2 className="price">{plan?.title}</h2>
          </div>
          <StatusBadge tone={paymentTone(me.payment)}>{paymentLabel(me.payment)}</StatusBadge>
        </div>
        <div className="stat" style={{ margin: '16px 0' }}>
          <b>{me.remaining} из {plan?.lessons}</b>
          <span>занятий осталось</span>
        </div>
        <div className="dots">
          {Array.from({ length: plan?.lessons ?? 0 }).map((_, i) => (
            <i key={i} className={i < me.used ? 'dot used' : 'dot left'} />
          ))}
        </div>
        <p className="tiny muted" style={{ marginTop: 12 }}>
          {formatMoney(plan?.price ?? 0)} за пакет · {formatMoney(plan?.perLesson ?? 0)} за урок
        </p>
      </SoftCard>
      <div className="section-h">
        <h3>Продлить</h3>
      </div>
      <Plans currentId={me.planId} />
    </section>
  )
}

function Plans({ currentId }: { currentId?: string }) {
  const { plans } = useStore()
  return (
    <div className="grid">
      {plans.map((p) => (
        <SoftCard key={p.id} className={p.featured ? 'plan featured' : 'plan'}>
          <div className="row">
            <strong>{p.title}</strong>
            {currentId === p.id && <StatusBadge tone="ok">ваш</StatusBadge>}
          </div>
          <div className="price" style={{ margin: '8px 0' }}>{formatMoney(p.price)}</div>
          <p className="tiny muted">{p.hint}</p>
        </SoftCard>
      ))}
    </div>
  )
}

export function StudentDetail() {
  const { students, selectedStudentId } = useStore()
  const student = students.find((x) => x.id === selectedStudentId)
  if (!student) {
    return (
      <section>
        <h1 className="page-title">Ученик</h1>
        <p className="empty">Карточка не найдена — вернитесь к списку учеников.</p>
      </section>
    )
  }
  return <StudentCard key={student.id} student={student} />
}

/** Код виден, пока ученик им не воспользовался: после первого входа он исчезает. */
function InviteCode({ code, name }: { code: string; name: string }) {
  const { toast } = useStore()
  const invite = `${name}, вход в Resona: зарегистрируйтесь по почте и введите код ${code}`

  return (
    <SoftCard className="mt-3 p-5">
      <div className="kicker">ещё не заходил</div>
      <div className="row" style={{ marginTop: 8, alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <b style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 26, letterSpacing: '0.12em' }}>{code}</b>
        <Button
          variant="outline"
          className="rounded-xl"
          onClick={() => {
            navigator.clipboard
              ?.writeText(invite)
              .then(() => toast('Приглашение скопировано'))
              .catch(() => toast(`Код: ${code}`))
          }}
        >
          Скопировать приглашение
        </Button>
      </div>
      <p className="tiny muted" style={{ marginTop: 8 }}>
        Ученик регистрируется по своей почте и вводит этот код один раз — так карточка становится его.
      </p>
    </SoftCard>
  )
}

function StudentCard({ student: s }: { student: Student }) {
  const {
    role,
    lessons,
    diary,
    plans,
    placeOf,
    setPayment,
    updateStudent,
    renewPlan,
    upsertLesson,
    addDiary,
    setScreen,
    toast,
  } = useStore()
  const [stars, setStars] = useState(4)
  const [note, setNote] = useState('')
  const [goal, setGoal] = useState(s.nextGoal)
  const [remaining, setRemaining] = useState(s.remaining)
  const [renewId, setRenewId] = useState(s.planId)
  const [noteError, setNoteError] = useState('')

  const plan = plans.find((p) => p.id === s.planId)
  const slots = [...lessons]
    .filter((l) => l.studentId === s.id)
    .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt))
  const notes = diary.filter((d) => d.studentId === s.id)
  const done = slots.filter((l) => l.status === 'done').length
  const missed = slots.filter((l) => l.status === 'missed').length

  return (
    <section>
      <h1 className="page-title">{s.name}</h1>
      <p className="lede">{s.voice} · со {s.since} · {s.city}</p>

      {s.inviteCode && <InviteCode code={s.inviteCode} name={s.name} />}

      <div className="grid-2">
        <SoftCard>
          <div className="stat">
            <b>{s.remaining}</b>
            <span>{plan?.title} · проведено {done}, пропусков {missed}</span>
          </div>
          {role === 'teacher' && (
            <div className="seg" style={{ marginTop: 14 }}>
              {(['paid', 'due', 'overdue'] as PaymentStatus[]).map((p) => (
                <button key={p} className={s.payment === p ? 'on' : ''} onClick={() => setPayment(s.id, p)}>
                  {paymentLabel(p)}
                </button>
              ))}
            </div>
          )}
        </SoftCard>
        <SoftCard>
          <p className="tiny muted">цель</p>
          <p style={{ marginTop: 6 }}>{s.nextGoal || 'не записана'}</p>
          <Button variant="outline" className="mt-3.5 rounded-xl" onClick={() => setScreen('schedule')}>
            В расписание
          </Button>
        </SoftCard>
      </div>

      {role === 'teacher' && (
        <SoftCard className="mt-3 p-5">
          <div className="kicker">карточка</div>
          <Field>
            <FieldLabel>цель</FieldLabel>
            <Textarea value={goal} onChange={(e) => setGoal(e.target.value)} />
          </Field>
          <Field className="mt-2.5">
            <FieldLabel>осталось занятий</FieldLabel>
            <Input type="number" min={0} value={remaining} onChange={(e) => setRemaining(Number(e.target.value))} />
          </Field>
          <Button
            className="mt-3 rounded-xl"
            onClick={() => {
              updateStudent(s.id, { nextGoal: goal.trim(), remaining })
              toast('Карточка обновлена')
            }}
          >
            Сохранить
          </Button>

          <div className="section-h" style={{ marginTop: 18 }}>
            <h3>Продлить абонемент</h3>
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
            <select className="search" style={{ margin: 0, flex: 1 }} value={renewId} onChange={(e) => setRenewId(e.target.value)}>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} · {formatMoney(p.price)}
                </option>
              ))}
            </select>
            <Button variant="outline" className="rounded-xl" onClick={() => renewPlan(s.id, renewId)}>
              Начислить
            </Button>
          </div>
        </SoftCard>
      )}

      <div className="section-h">
        <h3>Дневник педагога</h3>
      </div>
      {role === 'teacher' && (
        <SoftCard className="mb-3 p-5">
          <p className="tiny muted">оценка занятия</p>
          <div className="stars" style={{ marginTop: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className={n <= stars ? 'star on' : 'star'} onClick={() => setStars(n)}>
                {n}
              </button>
            ))}
          </div>
          <Field className="mt-3">
            <FieldLabel>запись после урока</FieldLabel>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Что получилось, что не трогать дома"
            />
          </Field>
          {noteError && <p className="err">{noteError}</p>}
          <Button
            className="mt-3 rounded-xl"
            onClick={() => {
              if (!note.trim()) return setNoteError('Пустую запись ученик не поймёт')
              addDiary(s.id, stars, note.trim())
              setNote('')
              setNoteError('')
            }}
          >
            Внести в дневник
          </Button>
        </SoftCard>
      )}
      <div className="grid">
        {notes.length === 0 && <p className="empty">Записей пока нет.</p>}
        {notes.map((d) => (
          <SoftCard key={d.id}>
            <div className="row">
              <strong style={{ color: 'var(--gold)' }}>
                {'★'.repeat(d.stars)}{'☆'.repeat(5 - d.stars)}
              </strong>
              <span className="tiny muted">{new Date(d.createdAt).toLocaleDateString('ru-RU')}</span>
            </div>
            <p style={{ marginTop: 8 }}>{d.comment}</p>
          </SoftCard>
        ))}
      </div>

      <div className="section-h">
        <h3>Уроки и домашние</h3>
      </div>
      <SoftCard>
        {slots.length === 0 && <p className="empty">Уроков ещё не было.</p>}
        {slots.map((l) => (
          <LessonRow
            key={l.id}
            date={new Date(l.startsAt).toLocaleString('ru-RU', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
            place={placeOf(l.locationId)?.name ?? ''}
            status={l.status}
            focus={l.focus}
            homework={l.homework}
            canEdit={role === 'teacher'}
            onSave={(focus, homework) => {
              upsertLesson({ ...l, focus, homework })
              toast('Урок обновлён')
            }}
          />
        ))}
      </SoftCard>
    </section>
  )
}

function LessonRow({
  date,
  place,
  status,
  focus,
  homework,
  canEdit,
  onSave,
}: {
  date: string
  place: string
  status: string
  focus: string
  homework: string
  canEdit: boolean
  onSave: (focus: string, homework: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState(focus)
  const [h, setH] = useState(homework)
  return (
    <div>
      <button className="cell" onClick={() => canEdit && setOpen((v) => !v)}>
        <div className="grow">
          <div className="title">{date} · {focus}</div>
          <div className="sub">{place} · {homework || 'домашнего нет'}</div>
        </div>
        <StatusBadge tone={status === 'done' ? 'ok' : status === 'upcoming' ? 'neutral' : 'bad'}>
          {status === 'done' ? 'был' : status === 'upcoming' ? 'впереди' : 'пропуск'}
        </StatusBadge>
      </button>
      {open && (
        <div style={{ padding: '0 4px 14px' }}>
          <label className="field">
            <span>план</span>
            <input value={f} onChange={(e) => setF(e.target.value)} />
          </label>
          <label className="field" style={{ marginTop: 8 }}>
            <span>домашнее</span>
            <textarea value={h} onChange={(e) => setH(e.target.value)} />
          </label>
          <Button
            className="mt-2.5 rounded-xl"
            onClick={() => {
              onSave(f, h)
              setOpen(false)
            }}
          >
            Сохранить
          </Button>
        </div>
      )}
    </div>
  )
}
