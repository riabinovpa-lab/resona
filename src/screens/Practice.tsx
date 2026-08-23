import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { StatusBadge, SoftCard } from '../components/app-ui'
import { Tuner } from '../components/Tuner'
import { useStore } from '../store-context'

export function Practice() {
  const { exercises, addPractice, me, studio, lessons, toggleHomework, setScreen } = useStore()
  const [exId, setExId] = useState(exercises[0]?.id ?? '')
  const ex = exercises.find((e) => e.id === exId) ?? exercises[0]

  const homework = [...lessons]
    .filter((l) => l.studentId === me.id && l.homework && l.status === 'done')
    .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt))[0]

  const weekMinutes = me.practiceWeek.reduce((a, b) => a + b, 0)

  return (
    <section>
      <h1 className="page-title">Практика</h1>
      <p className="lede">
        Разогрев, этюд, кусок песни. На этой неделе уже {weekMinutes} минут — счётчик видит {studio.teacher} в вашем
        прогрессе.
      </p>

      {homework && (
        <SoftCard variant="alert" className="mb-3">
          <div className="kicker">домашнее с прошлого урока</div>
          <p>{homework.homework}</p>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <Checkbox
              checked={!!homework.homeworkDoneAt}
              onCheckedChange={() => toggleHomework(homework.id)}
            />
            {homework.homeworkDoneAt ? 'сделано' : 'отметить, что сделал'}
          </label>
        </SoftCard>
      )}

      <Tuner targetMidi={ex?.targetMidi} />

      <div className="section-h">
        <h3>Этюды</h3>
        <Button variant="link" className="h-auto px-0 text-xs" onClick={() => setScreen('theory')}>
          теория
        </Button>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {exercises.map((e) => (
          <Button
            key={e.id}
            size="sm"
            variant={e.id === ex?.id ? 'default' : 'outline'}
            className="rounded-full"
            onClick={() => setExId(e.id)}
          >
            {e.title}
          </Button>
        ))}
      </div>

      {ex && (
        <SoftCard className="p-5">
          <div className="row">
            <strong>{ex.title}</strong>
            <StatusBadge>
              {ex.level} · {ex.minutes} мин
            </StatusBadge>
          </div>
          <p className="tiny" style={{ marginTop: 10, color: 'var(--cream-dim)' }}>{ex.description}</p>
          <ol style={{ margin: '14px 0 0', paddingLeft: 18, color: 'var(--cream-dim)' }}>
            {ex.steps.map((s) => (
              <li key={s} style={{ marginBottom: 8 }}>{s}</li>
            ))}
          </ol>
          <Button className="mt-4 w-full rounded-xl" onClick={() => addPractice(ex.minutes)}>
            Записать {ex.minutes} мин практики
          </Button>
        </SoftCard>
      )}
    </section>
  )
}
