import { Progress as Bar } from '@/components/ui/progress'
import { SoftCard, StatusBadge } from '../components/app-ui'
import { useStore } from '../store-context'
import { noteFromFreq, midiToFreq } from '../lib/pitch'

const DAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']

export function Progress() {
  const { me } = useStore()
  const maxMin = Math.max(...me.practiceWeek, 1)
  const low = noteFromFreq(midiToFreq(me.rangeLow))
  const high = noteFromFreq(midiToFreq(me.rangeHigh))
  const startL = noteFromFreq(midiToFreq(me.startLow))
  const startH = noteFromFreq(midiToFreq(me.startHigh))
  const span = 40
  const base = 40
  const left = ((me.rangeLow - base) / span) * 100
  const width = ((me.rangeHigh - me.rangeLow) / span) * 100

  return (
    <section>
      <h1 className="page-title">Прогресс</h1>
      <p className="lede">Не «стал лучше / стал хуже», а конкретные сдвиги: диапазон, навыки, репертуар, минуты.</p>

      <SoftCard className="p-5">
        <div className="kicker">рабочий диапазон</div>
        <div className="row">
          <strong>{low.name}</strong>
          <span className="muted">→</span>
          <strong>{high.name}</strong>
        </div>
        <div className="range" style={{ marginTop: 14 }}>
          <div className="range-track">
            <div className="range-fill" style={{ left: `${left}%`, width: `${width}%` }} />
          </div>
          <p className="tiny muted">
            Старт в {me.since}: {startL.name}–{startH.name}. Сейчас {low.nameRu} — {high.nameRu}.
          </p>
        </div>
      </SoftCard>

      <div className="section-h">
        <h3>Навыки с уроков</h3>
      </div>
      <SoftCard>
        {me.skills.map((sk) => (
          <div key={sk.id} style={{ marginBottom: 14 }}>
            <div className="row">
              <span>{sk.label}</span>
              <span className="tiny muted">{sk.value}/100</span>
            </div>
            <Bar value={sk.value} className="mt-1.5 h-1.5" />
          </div>
        ))}
      </SoftCard>

      <div className="section-h">
        <h3>Практика на неделе</h3>
        <span className="tiny muted">{me.practiceWeek.reduce((a, b) => a + b, 0)} мин</span>
      </div>
      <SoftCard>
        <div className="bars">
          {me.practiceWeek.map((m, i) => (
            <span
              key={DAYS[i]}
              className={m > 0 ? 'on' : ''}
              style={{ height: `${Math.max(6, (m / maxMin) * 100)}%` }}
            />
          ))}
        </div>
        <div className="week" style={{ margin: '8px 0 0' }}>
          {DAYS.map((d) => (
            <div key={d} className="tiny muted" style={{ textAlign: 'center' }}>{d}</div>
          ))}
        </div>
      </SoftCard>

      <div className="section-h">
        <h3>Репертуар</h3>
      </div>
      <SoftCard>
        {me.repertoire.map((song) => (
          <div key={song.title} className="cell">
            <div className="grow">
              <div className="title">{song.title}</div>
              <div className="sub">{song.artist}</div>
            </div>
            <StatusBadge>{song.status}</StatusBadge>
          </div>
        ))}
      </SoftCard>
    </section>
  )
}
