import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SoftCard, StatusBadge } from '../components/app-ui'
import { useStore } from '../store-context'
import {
  formatSlot,
  formatTime,
  fromDateTime,
  mondayOf,
  monthLabel,
  sameDay,
  toDateInput,
  toTimeInput,
  uid,
} from '../lib/format'
import { MOVE_DEADLINE_HOURS, WEEKDAY_NAMES } from '../lib/slots'
import type { Lesson, LessonStatus } from '../types'

const DAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const

type Draft = {
  id: string
  studentId: string
  date: string
  time: string
  duration: number
  focus: string
  homework: string
  locationId: string
  status: LessonStatus
  weeks: number
  seriesId?: string | null
  isNew: boolean
}

export function Schedule() {
  const {
    role,
    me,
    students,
    lessons,
    places,
    placeOf,
    setLessonStatus,
    upsertLesson,
    removeLesson,
    conflictFor,
    toggleHomework,
    addSeries,
    removeSeries,
    freeSlots,
    setScreen,
    toast,
  } = useStore()
  const now = new Date()
  const [mode, setMode] = useState<'week' | 'month'>('week')
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), now.getDate()))
  const [filter, setFilter] = useState('all')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState('')
  const [hoursOpen, setHoursOpen] = useState(false)

  const mineOnly = (l: Lesson) =>
    role === 'teacher' ? filter === 'all' || l.studentId === filter : l.studentId === me.id

  const weekDays = useMemo(() => {
    const monday = mondayOf(cursor)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d
    })
  }, [cursor])

  const monthCells = useMemo(() => {
    const start = mondayOf(new Date(cursor.getFullYear(), cursor.getMonth(), 1))
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [cursor])

  const visible = lessons
    .filter(mineOnly)
    .filter((l) => sameDay(new Date(l.startsAt), cursor))
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))

  const dayFree = useMemo(
    () => freeSlots(55, 35).filter((s) => sameDay(new Date(s.startsAt), cursor)),
    [freeSlots, cursor],
  )

  const countOn = (d: Date) =>
    lessons.filter((l) => mineOnly(l) && sameDay(new Date(l.startsAt), d) && l.status !== 'cancelled').length

  const shift = (dir: number) => {
    const next = new Date(cursor)
    if (mode === 'week') next.setDate(next.getDate() + dir * 7)
    else next.setMonth(next.getMonth() + dir)
    setCursor(next)
  }

  const openNew = (at?: { startsAt: string; locationId: string }) =>
    setDraft({
      id: uid('l'),
      studentId: students[0]?.id ?? '',
      date: at ? toDateInput(at.startsAt) : toDateInput(cursor.toISOString()),
      time: at ? toTimeInput(at.startsAt) : '18:00',
      duration: 55,
      focus: '',
      homework: '',
      locationId: at?.locationId ?? places[0]?.id ?? '',
      status: 'upcoming',
      weeks: 1,
      isNew: true,
    })

  const openEdit = (l: Lesson) =>
    setDraft({
      id: l.id,
      studentId: l.studentId,
      date: toDateInput(l.startsAt),
      time: toTimeInput(l.startsAt),
      duration: l.duration,
      focus: l.focus,
      homework: l.homework,
      locationId: l.locationId,
      status: l.status,
      weeks: 1,
      seriesId: l.seriesId ?? null,
      isNew: false,
    })

  const save = () => {
    if (!draft) return
    if (!draft.studentId) return setError('Выберите ученика')
    if (!draft.focus.trim()) return setError('Напишите, что делаем на уроке')

    const base = {
      studentId: draft.studentId,
      startsAt: fromDateTime(draft.date, draft.time),
      duration: Number(draft.duration) || 55,
      focus: draft.focus.trim(),
      homework: draft.homework.trim(),
      locationId: draft.locationId,
      status: draft.status,
    }

    if (draft.isNew && draft.weeks > 1) {
      const created = addSeries(base, draft.weeks)
      if (!created) return setError('Все даты серии заняты другими уроками')
      toast(
        created === draft.weeks
          ? `Серия из ${created} уроков поставлена`
          : `Поставлено ${created} из ${draft.weeks}: часть дат была занята`,
      )
      setDraft(null)
      setError('')
      return
    }

    const lesson: Lesson = { ...base, id: draft.id, seriesId: draft.seriesId ?? null }
    const clash = conflictFor(lesson)
    if (clash) {
      const who = students.find((s) => s.id === clash.studentId)?.name ?? 'другой урок'
      setError(`Пересекается: ${who}, ${formatTime(clash.startsAt)}`)
      return
    }

    upsertLesson(lesson)
    toast(draft.isNew ? 'Слот в расписании' : 'Урок обновлён')
    setDraft(null)
    setError('')
  }

  return (
    <section>
      <h1 className="page-title">Расписание</h1>
      <p className="lede">
        {role === 'teacher'
          ? 'Неделя и месяц. Отметка «был» или «пропуск» сразу списывает занятие с абонемента.'
          : `Ваши слоты. Перенести можно сам, если до урока больше ${MOVE_DEADLINE_HOURS} часов.`}
      </p>

      {role === 'teacher' ? <MoveRequests /> : <MyMoves />}

      <div className="row" style={{ marginBottom: 12 }}>
        <Tabs value={mode} onValueChange={(value) => setMode(value as 'week' | 'month')}>
          <TabsList>
            <TabsTrigger value="week">неделя</TabsTrigger>
            <TabsTrigger value="month">месяц</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => shift(-1)}>←</Button>
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setCursor(new Date())}>сегодня</Button>
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => shift(1)}>→</Button>
        </div>
      </div>

      {role === 'teacher' && (
        <select className="search" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">все ученики</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      )}

      {mode === 'week' ? (
        <>
          <p className="tiny muted" style={{ marginBottom: 8 }}>
            {weekDays[0]?.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} —{' '}
            {weekDays[6]?.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
          </p>
          <div className="week">
            {weekDays.map((d, i) => (
              <button
                key={d.toISOString()}
                className={`day${sameDay(d, cursor) ? ' on' : ''}${sameDay(d, now) ? ' today' : ''}`}
                onClick={() => setCursor(d)}
              >
                <small>{DAYS[i]}</small>
                <b>{d.getDate()}</b>
                {countOn(d) > 0 && <i className="cal-dot" />}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="tiny muted" style={{ marginBottom: 8 }}>{monthLabel(cursor.getFullYear(), cursor.getMonth())}</p>
          <div className="month-head">
            {DAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="month">
            {monthCells.map((d) => {
              const n = countOn(d)
              return (
                <button
                  key={d.toISOString()}
                  className={`mday${sameDay(d, cursor) ? ' on' : ''}${sameDay(d, now) ? ' today' : ''}${
                    d.getMonth() !== cursor.getMonth() ? ' dim' : ''
                  }`}
                  onClick={() => setCursor(d)}
                >
                  <b>{d.getDate()}</b>
                  {n > 0 && <span className="mcount">{n}</span>}
                </button>
              )
            })}
          </div>
        </>
      )}

      <div className="section-h">
        <h3>{cursor.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
        {role === 'teacher' && (
          <Button variant="link" className="h-auto px-0 text-xs" onClick={() => openNew()}>
            + слот
          </Button>
        )}
      </div>

      <SoftCard>
        {visible.length === 0 && (
          <p className="empty">
            {role === 'teacher' ? 'Слотов нет. Можно поставить урок кнопкой «+ слот».' : 'В этот день занятий нет.'}
          </p>
        )}
        {visible.map((l) => (
          <LessonRow
            key={l.id}
            lesson={l}
            past={+new Date(l.startsAt) < now.getTime() - 60 * 60 * 1000}
            onEdit={() => openEdit(l)}
            onStatus={setLessonStatus}
            onHomework={() => toggleHomework(l.id)}
            onPlaces={() => setScreen('places')}
          />
        ))}
      </SoftCard>

      {role === 'teacher' && (
        <>
          <div className="section-h">
            <h3>Свободно в этот день</h3>
            <button className="tiny" onClick={() => setHoursOpen((v) => !v)}>
              {hoursOpen ? 'скрыть окна' : 'рабочие окна'}
            </button>
          </div>
          <div className="card pad-lg">
            {dayFree.length === 0 ? (
              <p className="empty">
                Свободных окон нет: либо всё занято, либо в этот день вы не работаете.
              </p>
            ) : (
              <div className="chips">
                {dayFree.map((s) => (
                  <button key={s.startsAt} className="chip" onClick={() => openNew(s)}>
                    {formatTime(s.startsAt)} · {placeOf(s.locationId)?.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {hoursOpen && <WorkingHours />}
        </>
      )}

      {draft && role === 'teacher' && (
        <div className="card pad-lg" style={{ marginTop: 12 }}>
          <div className="kicker">{draft.isNew ? 'новый слот' : 'редактирование урока'}</div>
          <div className="grid-2">
            <label className="field">
              <span>ученик</span>
              <select value={draft.studentId} onChange={(e) => setDraft({ ...draft, studentId: e.target.value })}>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>кабинет</span>
              <select value={draft.locationId} onChange={(e) => setDraft({ ...draft, locationId: e.target.value })}>
                {places.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>дата</span>
              <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
            </label>
            <label className="field">
              <span>время</span>
              <input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} />
            </label>
            <label className="field">
              <span>минуты</span>
              <input
                type="number"
                min={25}
                max={120}
                step={5}
                value={draft.duration}
                onChange={(e) => setDraft({ ...draft, duration: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              <span>статус</span>
              <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as LessonStatus })}>
                <option value="upcoming">ожидается</option>
                <option value="done">состоялся</option>
                <option value="missed">пропуск</option>
                <option value="cancelled">отмена</option>
              </select>
            </label>
          </div>

          {draft.isNew && (
            <label className="field" style={{ marginTop: 10 }}>
              <span>повторять еженедельно</span>
              <select value={draft.weeks} onChange={(e) => setDraft({ ...draft, weeks: Number(e.target.value) })}>
                <option value={1}>один урок</option>
                {[4, 6, 8, 12].map((n) => (
                  <option key={n} value={n}>
                    {n} недель, то же время
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="field" style={{ marginTop: 10 }}>
            <span>план занятия</span>
            <input
              value={draft.focus}
              onChange={(e) => setDraft({ ...draft, focus: e.target.value })}
              placeholder="опора, пассаж, разбор куплета"
            />
          </label>
          <label className="field" style={{ marginTop: 10 }}>
            <span>домашнее задание</span>
            <textarea value={draft.homework} onChange={(e) => setDraft({ ...draft, homework: e.target.value })} />
          </label>
          {error && <p className="err">{error}</p>}
          <div className="row" style={{ marginTop: 14, flexWrap: 'wrap' }}>
            <Button className="rounded-xl" onClick={save}>Сохранить</Button>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setDraft(null)
                setError('')
              }}
            >
              Отмена
            </Button>
            {!draft.isNew && (
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  removeLesson(draft.id)
                  toast('Слот удалён')
                  setDraft(null)
                }}
              >
                Удалить
              </Button>
            )}
            {!draft.isNew && draft.seriesId && (
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  removeSeries(draft.seriesId as string)
                  setDraft(null)
                }}
              >
                Снять всю серию
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function LessonRow({
  lesson,
  past,
  onEdit,
  onStatus,
  onHomework,
  onPlaces,
}: {
  lesson: Lesson
  past: boolean
  onEdit: () => void
  onStatus: (id: string, status: LessonStatus) => void
  onHomework: () => void
  onPlaces: () => void
}) {
  const { role, studio, studentOf, placeOf, moveFor, canMove } = useStore()
  const [moving, setMoving] = useState(false)
  const student = studentOf(lesson.studentId)
  const place = placeOf(lesson.locationId)
  const pending = moveFor(lesson.id)

  return (
    <div className={lesson.status === 'upcoming' && past ? 'cell needs' : 'cell'}>
      <div className="avatar">{role === 'teacher' ? student?.short : studio.teacherShort}</div>
      <div className="grow">
        <div className="title">
          {formatTime(lesson.startsAt)} · {role === 'teacher' ? student?.name : lesson.focus}
          {lesson.seriesId && <StatusBadge className="ml-2">серия</StatusBadge>}
        </div>
        <div className="sub">
          {role === 'teacher' ? lesson.focus : `${student?.voice} · ${lesson.duration} мин`} ·{' '}
          {place?.name ?? 'кабинет'}
        </div>
        {lesson.homework && <div className="sub">дома: {lesson.homework}</div>}
        {pending && (
          <div className="sub" style={{ color: 'var(--gold)' }}>
            заявка на перенос: {formatSlot(pending.proposedAt)}
          </div>
        )}

        {role === 'student' && place && (
          <button className="tiny" style={{ marginTop: 4 }} onClick={onPlaces}>
            как пройти
          </button>
        )}
        {role === 'student' && lesson.homework && lesson.status === 'done' && (
          <button
            className={lesson.homeworkDoneAt ? 'check on' : 'check'}
            style={{ marginTop: 8 }}
            onClick={onHomework}
          >
            {lesson.homeworkDoneAt ? 'сделано' : 'отметить домашнее'}
          </button>
        )}
        {role === 'student' && lesson.status === 'upcoming' && !pending && (
          canMove(lesson) ? (
            <button className="tiny" style={{ marginTop: 6 }} onClick={() => setMoving((v) => !v)}>
              {moving ? 'не переносить' : 'перенести'}
            </button>
          ) : (
            <p className="tiny muted" style={{ marginTop: 6 }}>
              До урока меньше {MOVE_DEADLINE_HOURS} часов — перенос только через педагога, занятие спишется.
            </p>
          )
        )}
        {moving && <MovePicker lesson={lesson} onDone={() => setMoving(false)} />}
      </div>

      {role === 'teacher' ? (
        <div className="chips">
          {lesson.status === 'upcoming' ? (
            <>
              <button className="chip" onClick={() => onStatus(lesson.id, 'done')}>был</button>
              <button className="chip" onClick={() => onStatus(lesson.id, 'missed')}>не был</button>
            </>
          ) : (
            <button className="chip" onClick={() => onStatus(lesson.id, 'upcoming')}>вернуть</button>
          )}
          <button className="chip" onClick={onEdit}>править</button>
        </div>
      ) : (
        <span
          className={`badge ${lesson.status === 'done' ? 'ok' : lesson.status === 'upcoming' ? 'neutral' : 'bad'}`}
        >
          {statusLabel(lesson.status)}
        </span>
      )}
    </div>
  )
}

function MovePicker({ lesson, onDone }: { lesson: Lesson; onDone: () => void }) {
  const { freeSlots, placeOf, requestMove, studio } = useStore()
  const [picked, setPicked] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const options = useMemo(() => freeSlots(lesson.duration, 14).slice(0, 24), [freeSlots, lesson.duration])

  return (
    <div className="card pad-lg" style={{ marginTop: 10 }}>
      <div className="kicker">свободные окна на две недели</div>
      {options.length === 0 ? (
        <p className="empty">Свободных окон нет. Напишите {studio.teacher} в переписке.</p>
      ) : (
        <div className="chips" style={{ marginTop: 8 }}>
          {options.map((s) => (
            <button
              key={s.startsAt}
              className={picked === s.startsAt ? 'chip active' : 'chip'}
              onClick={() => setPicked(s.startsAt)}
            >
              {formatSlot(s.startsAt)} · {placeOf(s.locationId)?.name}
            </button>
          ))}
        </div>
      )}
      <label className="field" style={{ marginTop: 10 }}>
        <span>почему переносите</span>
        <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="не успеваю с работы" />
      </label>
      {error && <p className="err">{error}</p>}
      <Button
        className="mt-2.5 rounded-xl"
        onClick={() => {
          if (!picked) return setError('Выберите новое время')
          requestMove(lesson.id, picked, comment.trim())
          onDone()
        }}
      >
        Отправить заявку
      </Button>
    </div>
  )
}

function MoveRequests() {
  const { moves, lessons, studentOf, resolveMove } = useStore()
  const pending = moves.filter((m) => m.status === 'pending')
  if (pending.length === 0) return null

  return (
    <div className="card pad-lg alert" style={{ marginBottom: 14 }}>
      <div className="kicker">заявки на перенос · {pending.length}</div>
      {pending.map((m) => {
        const lesson = lessons.find((l) => l.id === m.lessonId)
        const student = studentOf(m.studentId)
        return (
          <div key={m.id} style={{ marginTop: 12 }}>
            <strong>{student?.name}</strong>
            <p className="tiny muted" style={{ marginTop: 4 }}>
              {lesson ? formatSlot(lesson.startsAt) : 'урок удалён'} → {formatSlot(m.proposedAt)}
            </p>
            {m.comment && <p className="tiny" style={{ marginTop: 4 }}>{m.comment}</p>}
            <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
              <Button className="rounded-xl" onClick={() => resolveMove(m.id, true)}>Перенести</Button>
              <Button variant="outline" className="rounded-xl" onClick={() => resolveMove(m.id, false)}>Отклонить</Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Решение по переносу должно догонять ученика: отказ иначе останется незамеченным. */
function MyMoves() {
  const { me, moves, studio } = useStore()
  const [weekAgo] = useState(() => Date.now() - 7 * 86400000)
  const mine = moves.filter(
    (m) => m.studentId === me.id && (m.status === 'pending' || +new Date(m.decidedAt ?? 0) > weekAgo),
  )
  if (mine.length === 0) return null

  return (
    <div className="card pad-lg" style={{ marginBottom: 14 }}>
      <div className="kicker">переносы</div>
      {mine.map((m) => (
        <p key={m.id} className="tiny" style={{ marginTop: 8 }}>
          {formatSlot(m.proposedAt)} —{' '}
          {m.status === 'pending' ? (
            <span className="muted">ждём ответа · {studio.teacher}</span>
          ) : m.status === 'accepted' ? (
            <span style={{ color: 'var(--gold)' }}>перенесено</span>
          ) : (
            <span className="muted">отклонено, урок остаётся на прежнем времени</span>
          )}
        </p>
      ))}
    </div>
  )
}

function WorkingHours() {
  const { slots, places, addSlot, removeSlot, placeOf } = useStore()
  const [form, setForm] = useState({ weekday: 1, from: '17:00', to: '21:00', locationId: places[0]?.id ?? '' })
  const [error, setError] = useState('')

  const sorted = [...slots].sort((a, b) => a.weekday - b.weekday || a.from.localeCompare(b.from))

  return (
    <div className="card pad-lg" style={{ marginTop: 12 }}>
      <div className="kicker">когда вы принимаете</div>
      <p className="tiny muted" style={{ marginTop: 4 }}>
        Из этих окон вычитаются занятые уроки — то, что осталось, ученики видят как свободное время.
      </p>

      <div style={{ marginTop: 12 }}>
        {sorted.length === 0 && <p className="empty">Окон нет — ученики не увидят свободного времени.</p>}
        {sorted.map((s) => (
          <div key={s.id} className="cell">
            <div className="grow">
              <div className="title">
                {WEEKDAY_NAMES[s.weekday - 1]} · {s.from}–{s.to}
              </div>
              <div className="sub">{placeOf(s.locationId)?.name ?? 'кабинет'}</div>
            </div>
            <button className="chip" onClick={() => removeSlot(s.id)}>убрать</button>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginTop: 12 }}>
        <label className="field">
          <span>день</span>
          <select value={form.weekday} onChange={(e) => setForm({ ...form, weekday: Number(e.target.value) })}>
            {WEEKDAY_NAMES.map((d, i) => (
              <option key={d} value={i + 1}>{d}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>кабинет</span>
          <select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
            {places.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>с</span>
          <input type="time" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
        </label>
        <label className="field">
          <span>до</span>
          <input type="time" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
        </label>
      </div>
      {error && <p className="err">{error}</p>}
      <Button
        className="mt-3 rounded-xl"
        onClick={() => {
          if (form.from >= form.to) return setError('Начало должно быть раньше конца')
          if (!form.locationId) return setError('Выберите кабинет')
          setError('')
          addSlot(form)
        }}
      >
        Добавить окно
      </Button>
    </div>
  )
}

function statusLabel(status: LessonStatus): string {
  if (status === 'upcoming') return 'ожидается'
  if (status === 'done') return 'состоялся'
  if (status === 'missed') return 'пропуск'
  return 'отмена'
}
