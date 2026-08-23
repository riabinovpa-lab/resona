import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { Initials, SoftCard } from '../components/app-ui'
import { useStore } from '../store-context'
import { callName } from '../lib/format'

const stamp = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** У ученика чат — это сразу переписка с педагогом, у педагога — список диалогов. */
export function Chat() {
  const { role, me } = useStore()
  return role === 'teacher' ? <ThreadList /> : <Conversation studentId={me.id} />
}

export function Thread() {
  const { selectedStudentId, studentOf } = useStore()
  const student = selectedStudentId ? studentOf(selectedStudentId) : undefined
  if (!student) {
    return (
      <section>
        <h1 className="page-title">Переписка</h1>
        <p className="empty">Ученик не найден.</p>
      </section>
    )
  }
  return <Conversation studentId={student.id} />
}

function ThreadList() {
  const { students, messages, openThread, markSeen, seenChatAt } = useStore()
  // Метки «новое» считаем от состояния на момент входа, иначе они гаснут на глазах.
  const [openedAt] = useState(seenChatAt)

  useEffect(() => {
    markSeen('chat')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rows = students
    .map((s) => {
      const thread = messages.filter((m) => m.studentId === s.id)
      const last = thread[thread.length - 1]
      const fresh = thread.filter(
        (m) => m.from === 'student' && new Date(m.createdAt) > new Date(openedAt),
      ).length
      return { student: s, last, fresh }
    })
    .sort((a, b) => {
      const at = a.last ? new Date(a.last.createdAt).getTime() : 0
      const bt = b.last ? new Date(b.last.createdAt).getTime() : 0
      return bt - at
    })

  return (
    <section>
      <h1 className="page-title">Переписка</h1>
      <p className="lede">Личный диалог с каждым учеником. Объявления для всех — в рассылке.</p>

      <SoftCard className="p-2">
        {rows.map(({ student, last, fresh }) => (
          <button key={student.id} className="cell" onClick={() => openThread(student.id)}>
            <Initials text={student.short} />
            <div className="grow">
              <div className="title">{student.name}</div>
              <div className="sub">
                {last ? `${last.from === 'teacher' ? 'Вы: ' : ''}${last.text}` : 'Переписки ещё не было'}
              </div>
            </div>
            <div className="chips">
              {last && <span className="tiny muted">{stamp(last.createdAt)}</span>}
              {fresh > 0 && <span className="count">{fresh}</span>}
            </div>
          </button>
        ))}
      </SoftCard>
    </section>
  )
}

function Conversation({ studentId }: { studentId: string }) {
  const { role, studio, studentOf, messages, addMessage, markSeen } = useStore()
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const student = studentOf(studentId)
  const thread = messages.filter((m) => m.studentId === studentId)

  useEffect(() => {
    markSeen('chat')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [thread.length])

  const send = () => {
    if (!text.trim()) return
    addMessage(studentId, text.trim())
    setText('')
  }

  const title = role === 'teacher' ? student?.name ?? 'Ученик' : studio.teacher

  return (
    <section>
      <h1 className="page-title">{title}</h1>
      <p className="lede">
        {role === 'teacher'
          ? 'Вопросы между уроками, переносы, записи из дома.'
          : 'Вопрос по домашке или перенос — сюда. Срочное дублируйте звонком.'}
      </p>

      <div className="thread">
        {thread.length === 0 && <p className="empty">Сообщений нет. Напишите первым.</p>}
        {thread.map((m) => (
          <div key={m.id} className={m.from === role ? 'bubble mine' : 'bubble'}>
            <div className="row">
              <span className="tiny muted">
                {m.from === 'teacher' ? studio.teacher : student && callName(student.name, student.callName)}
              </span>
              <span className="tiny muted">{stamp(m.createdAt)}</span>
            </div>
            <p>{m.text}</p>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <SoftCard className="mt-3 p-5">
        <Field>
          <FieldLabel>сообщение · Enter отправляет</FieldLabel>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
          />
        </Field>
        <Button className="mt-2.5 w-full rounded-xl" onClick={send}>
          Отправить
        </Button>
      </SoftCard>
    </section>
  )
}
