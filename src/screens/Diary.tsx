import { SoftCard } from '../components/app-ui'
import { useStore } from '../store-context'

export function Diary() {
  const { me, diary, students, role, studio, openStudent } = useStore()
  const mine = role === 'teacher' ? diary : diary.filter((d) => d.studentId === me.id)

  return (
    <section>
      <h1 className="page-title">Дневник</h1>
      <p className="lede">
        {role === 'teacher'
          ? 'Комментарии и звёзды после урока. Полная карточка — в ученике.'
          : 'Записи после занятий: не оценка личности, а что закрепить и что не трогать.'}
      </p>
      <div className="grid">
        {mine.map((d) => {
          const st = students.find((s) => s.id === d.studentId)
          return (
            <SoftCard
              key={d.id}
              className="cursor-pointer text-left"
              onClick={() => role === 'teacher' && st && openStudent(st.id)}
            >
              <div className="row">
                <strong>{role === 'teacher' ? st?.name : studio.teacher}</strong>
                <span className="tiny muted">{new Date(d.createdAt).toLocaleDateString('ru-RU')}</span>
              </div>
              <p className="tiny" style={{ marginTop: 6, color: 'var(--gold)' }}>
                {'★'.repeat(d.stars)}{'☆'.repeat(5 - d.stars)}
              </p>
              <p style={{ marginTop: 8 }}>{d.comment}</p>
            </SoftCard>
          )
        })}
        {mine.length === 0 && <p className="muted">Пока пусто.</p>}
      </div>
    </section>
  )
}
