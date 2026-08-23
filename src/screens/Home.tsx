import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Initials, SoftCard, StatusBadge, paymentTone } from '../components/app-ui'
import { useStore } from '../store-context'
import {
  callName,
  formatMoney,
  formatTime,
  greeting,
  mondayOf,
  paymentLabel,
  relativeLesson,
  sameDay,
} from '../lib/format'

export function Home() {
  const store = useStore()
  const { role } = store
  return role === 'teacher' ? <TeacherHome /> : <StudentHome />
}

function TeacherHome() {
  const {
    studio,
    students,
    lessons,
    plans,
    notices,
    unreadChat,
    pendingMoves,
    placeOf,
    setScreen,
    openStudent,
    setLessonStatus,
  } = useStore()
  const now = new Date()
  const monday = mondayOf(now).getTime()

  const today = lessons
    .filter((l) => sameDay(new Date(l.startsAt), now) && l.status !== 'cancelled')
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))

  const pending = lessons
    .filter((l) => l.status === 'upcoming' && +new Date(l.startsAt) < now.getTime() - 60 * 60 * 1000)
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))

  const weekLessons = lessons.filter((l) => {
    const diff = (+new Date(l.startsAt) - monday) / 86400000
    return diff >= 0 && diff < 7 && l.status !== 'cancelled'
  })

  const revenue = weekLessons.reduce((sum, l) => {
    const st = students.find((s) => s.id === l.studentId)
    return sum + (plans.find((p) => p.id === st?.planId)?.perLesson ?? 0)
  }, 0)

  const alerts = students.filter((s) => s.payment !== 'paid' || s.remaining <= 1)

  return (
    <section>
      <p className="kicker">{studio.city}</p>
      <h1 className="page-title">{greeting()}, {studio.teacher.split(' ')[0]}</h1>
      <p className="lede">
        {today.length ? `Сегодня ${today.length} урока в сетке.` : 'Сегодня уроков нет.'} На неделе {weekLessons.length} слотов.
      </p>

      {pendingMoves > 0 && (
        <Alert
          className="mb-3 cursor-pointer border-primary/30 bg-card"
          onClick={() => setScreen('schedule')}
        >
          <AlertTitle className="text-primary">заявки на перенос · {pendingMoves}</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Ученики предложили новое время. Подтвердить или отклонить — в расписании.
          </AlertDescription>
        </Alert>
      )}

      {pending.length > 0 && (
        <SoftCard variant="alert" className="mb-3">
          <div className="kicker">нужно отметить</div>
          <p className="tiny muted" style={{ marginBottom: 8 }}>
            Пока урок не отмечен, занятие не спишется с абонемента.
          </p>
          {pending.map((l) => {
            const st = students.find((s) => s.id === l.studentId)
            return (
              <div key={l.id} className="cell needs">
                <div className="grow">
                  <div className="title">{st?.name}</div>
                  <div className="sub">
                    {new Date(l.startsAt).toLocaleString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })} · {l.focus}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => setLessonStatus(l.id, 'done')}>
                    был
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => setLessonStatus(l.id, 'missed')}>
                    не был
                  </Button>
                </div>
              </div>
            )
          })}
        </SoftCard>
      )}

      <div className="grid-2" style={{ marginTop: 12 }}>
        <SoftCard variant="hero">
          <div className="kicker">сегодня</div>
          {today.length === 0 ? (
            <>
              <h2>Свободный день</h2>
              <Button variant="outline" className="mt-3 rounded-xl" onClick={() => setScreen('schedule')}>
                Открыть сетку
              </Button>
            </>
          ) : (
            today.map((l) => {
              const st = students.find((s) => s.id === l.studentId)
              return (
                <div key={l.id} className="cell">
                  <button type="button" onClick={() => st && openStudent(st.id)}>
                    <Initials text={st?.short ?? '?'} />
                  </button>
                  <button className="grow" style={{ textAlign: 'left' }} onClick={() => st && openStudent(st.id)}>
                    <div className="title">{formatTime(l.startsAt)} · {st?.name}</div>
                    <div className="sub">{l.focus} · {placeOf(l.locationId)?.name}</div>
                  </button>
                  {l.status === 'upcoming' ? (
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => setLessonStatus(l.id, 'done')}>
                      был
                    </Button>
                  ) : (
                    <StatusBadge tone={l.status === 'done' ? 'ok' : 'bad'}>
                      {l.status === 'done' ? 'состоялся' : 'пропуск'}
                    </StatusBadge>
                  )}
                </div>
              )
            })
          )}
        </SoftCard>
        <div className="grid">
          <SoftCard>
            <div className="stat">
              <b>{formatMoney(revenue)}</b>
              <span>оценка выручки за слоты недели</span>
            </div>
          </SoftCard>
          <SoftCard>
            <div className="stat">
              <b>{students.filter((s) => s.payment === 'paid').length}/{students.length}</b>
              <span>абонементов в порядке</span>
            </div>
          </SoftCard>
          {unreadChat > 0 && (
            <SoftCard className="cursor-pointer" onClick={() => setScreen('chat')}>
              <div className="stat">
                <b>{unreadChat}</b>
                <span>новых сообщений от учеников</span>
              </div>
            </SoftCard>
          )}
        </div>
      </div>

      <div className="section-h">
        <h3>Нужно внимание</h3>
        <Button variant="link" className="h-auto px-0 text-xs" onClick={() => setScreen('memberships')}>
          все ученики
        </Button>
      </div>
      <SoftCard>
        {alerts.length === 0 && <p className="empty">Долгов нет, абонементы не на исходе.</p>}
        {alerts.map((s) => (
          <button key={s.id} className="cell" onClick={() => openStudent(s.id)}>
            <Initials text={s.short} />
            <div className="grow">
              <div className="title">{s.name}</div>
              <div className="sub">осталось {s.remaining} · {paymentLabel(s.payment)}</div>
            </div>
            <StatusBadge tone={s.payment === 'paid' ? 'warn' : paymentTone(s.payment)}>
              {s.payment === 'paid' ? 'заканчивается' : paymentLabel(s.payment)}
            </StatusBadge>
          </button>
        ))}
      </SoftCard>

      {notices[0] && (
        <SoftCard variant="alert" className="mt-3">
          <div className="kicker">последняя рассылка</div>
          <strong>{notices[0].title}</strong>
          <p className="tiny" style={{ marginTop: 6, color: 'var(--cream-dim)' }}>{notices[0].body}</p>
          <Button variant="outline" className="mt-3 rounded-xl" onClick={() => setScreen('notices')}>
            Написать всем
          </Button>
        </SoftCard>
      )}
    </section>
  )
}

function StudentHome() {
  const {
    me,
    studio,
    lessons,
    plans,
    notices,
    diary,
    unreadChat,
    unreadNotices,
    placeOf,
    setScreen,
    toggleHomework,
  } = useStore()
  const now = new Date()
  const mine = lessons.filter((l) => l.studentId === me.id)
  const next = mine
    .filter((l) => l.status === 'upcoming' && +new Date(l.startsAt) > now.getTime() - 30 * 60 * 1000)
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))[0]

  const homework = mine
    .filter((l) => l.homework && l.status === 'done')
    .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt))[0]

  const plan = plans.find((p) => p.id === me.planId)
  const place = next ? placeOf(next.locationId) : undefined
  const lastNote = diary.filter((d) => d.studentId === me.id)[0]
  const weekMinutes = me.practiceWeek.reduce((a, b) => a + b, 0)

  return (
    <section>
      <p className="kicker">{studio.teacher}</p>
      <h1 className="page-title">{greeting()}, {callName(me.name, me.callName)}</h1>
      <p className="lede">{me.nextGoal}</p>

      {next ? (
        <SoftCard variant="hero">
          <div className="kicker">ближайший урок · {relativeLesson(next.startsAt)}</div>
          <h2>{next.focus}</h2>
          <div className="meta-row">
            <span>
              {new Date(next.startsAt).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' })}
            </span>
            <span>{formatTime(next.startsAt)} · {next.duration} мин</span>
            <span>{place?.name}</span>
          </div>
          {place && (
            <Button variant="outline" className="mt-3.5 rounded-xl" onClick={() => setScreen('places')}>
              Как пройти · {place.address}
            </Button>
          )}
        </SoftCard>
      ) : (
        <SoftCard variant="hero">
          <div className="kicker">расписание</div>
          <h2>Следующий урок не назначен</h2>
          <p className="tiny muted" style={{ marginTop: 8 }}>
            Напишите {studio.teacher}, чтобы забрать слот на неделе.
          </p>
          <Button className="mt-3 rounded-xl" onClick={() => setScreen('chat')}>
            Написать {studio.teacher}
          </Button>
        </SoftCard>
      )}

      {homework && (
        <SoftCard variant="alert" className="mt-3">
          <div className="kicker">домашнее к следующему уроку</div>
          <p>{homework.homework}</p>
          <label className="mt-3.5 flex items-center gap-2 text-sm">
            <Checkbox
              checked={!!homework.homeworkDoneAt}
              onCheckedChange={() => toggleHomework(homework.id)}
            />
            {homework.homeworkDoneAt ? 'сделано' : 'отметить, что сделал'}
          </label>
        </SoftCard>
      )}

      <div className="grid-2" style={{ marginTop: 12 }}>
        <SoftCard className="cursor-pointer text-left" onClick={() => setScreen('memberships')}>
          <div className="row">
            <div className="stat">
              <b>{me.remaining}</b>
              <span>занятий в абонементе</span>
            </div>
            <StatusBadge tone={paymentTone(me.payment)}>{paymentLabel(me.payment)}</StatusBadge>
          </div>
          <div className="dots" style={{ marginTop: 14 }}>
            {Array.from({ length: plan?.lessons ?? 8 }).map((_, i) => (
              <i key={i} className={i < me.used ? 'dot used' : 'dot left'} />
            ))}
          </div>
          <p className="tiny muted" style={{ marginTop: 10 }}>
            {plan?.title} · {formatMoney(plan?.perLesson ?? 0)} / урок
          </p>
        </SoftCard>
        <SoftCard>
          <div className="stat">
            <b>{weekMinutes} мин</b>
            <span>практики на этой неделе</span>
          </div>
          <p className="tiny muted" style={{ marginTop: 12 }}>
            {me.streak} дней подряд. Не обязательно долго — обязательно часто.
          </p>
          <div className="mt-3.5 flex flex-wrap gap-2">
            <Button size="sm" className="rounded-full" onClick={() => setScreen('practice')}>
              практика и тюнер
            </Button>
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setScreen('progress')}>
              прогресс
            </Button>
          </div>
        </SoftCard>
      </div>

      {lastNote && (
        <SoftCard className="mt-3 cursor-pointer text-left" onClick={() => setScreen('diary')}>
          <div className="kicker">дневник · {new Date(lastNote.createdAt).toLocaleDateString('ru-RU')}</div>
          <p className="tiny" style={{ color: 'var(--gold)' }}>
            {'★'.repeat(lastNote.stars)}{'☆'.repeat(5 - lastNote.stars)}
          </p>
          <p style={{ marginTop: 8 }}>{lastNote.comment}</p>
        </SoftCard>
      )}

      {(unreadNotices > 0 || unreadChat > 0) && (
        <SoftCard className="mt-3">
          <div className="kicker">новое</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {unreadNotices > 0 && (
              <Button size="sm" className="rounded-full" onClick={() => setScreen('notices')}>
                объявления · {unreadNotices}
              </Button>
            )}
            {unreadChat > 0 && (
              <Button size="sm" className="rounded-full" onClick={() => setScreen('chat')}>
                сообщения · {unreadChat}
              </Button>
            )}
          </div>
        </SoftCard>
      )}

      {notices[0] && unreadNotices === 0 && (
        <SoftCard className="mt-3">
          <div className="kicker">от студии</div>
          <strong>{notices[0].title}</strong>
          <p className="tiny" style={{ marginTop: 6, color: 'var(--cream-dim)' }}>{notices[0].body}</p>
        </SoftCard>
      )}
    </section>
  )
}
