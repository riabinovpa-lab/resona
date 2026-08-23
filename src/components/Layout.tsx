import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Toaster } from '@/components/ui/sonner'
import { Initials } from './app-ui'
import { Icon } from './Icons'
import { useStore } from '../store-context'
import type { IconName, Screen, Tab } from '../types'

const STUDENT_TABS: Tab[] = [
  { id: 'home', label: 'Главная', icon: 'home' },
  { id: 'schedule', label: 'Сетка', icon: 'calendar' },
  { id: 'practice', label: 'Практика', icon: 'mic' },
  { id: 'chat', label: 'Чат', icon: 'chat' },
  { id: 'more', label: 'Ещё', icon: 'more' },
]

const TEACHER_TABS: Tab[] = [
  { id: 'home', label: 'Студия', icon: 'home' },
  { id: 'schedule', label: 'Сетка', icon: 'calendar' },
  { id: 'memberships', label: 'Ученики', icon: 'people' },
  { id: 'chat', label: 'Чат', icon: 'chat' },
  { id: 'more', label: 'Ещё', icon: 'more' },
]

const STUDENT_NAV: { id: Screen; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Главная', icon: 'home' },
  { id: 'schedule', label: 'Расписание', icon: 'calendar' },
  { id: 'practice', label: 'Практика', icon: 'mic' },
  { id: 'progress', label: 'Прогресс', icon: 'chart' },
  { id: 'diary', label: 'Дневник', icon: 'star' },
  { id: 'chat', label: 'Чат', icon: 'chat' },
  { id: 'notices', label: 'Объявления', icon: 'bell' },
  { id: 'places', label: 'Кабинеты', icon: 'pin' },
  { id: 'theory', label: 'Теория', icon: 'book' },
  { id: 'memberships', label: 'Абонемент', icon: 'card' },
  { id: 'feedback', label: 'Отзыв об уроке', icon: 'star' },
]

const TEACHER_NAV: { id: Screen; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Студия', icon: 'home' },
  { id: 'schedule', label: 'Расписание', icon: 'calendar' },
  { id: 'memberships', label: 'Ученики', icon: 'people' },
  { id: 'diary', label: 'Дневник', icon: 'star' },
  { id: 'chat', label: 'Чат', icon: 'chat' },
  { id: 'notices', label: 'Рассылка', icon: 'bell' },
  { id: 'places', label: 'Кабинеты', icon: 'pin' },
  { id: 'theory', label: 'Теория', icon: 'book' },
  { id: 'feedback', label: 'Отзывы', icon: 'star' },
]

const ROOT_SCREENS: Screen[] = ['home', 'schedule', 'practice', 'chat', 'memberships', 'more']

export function Layout({ children }: { children: ReactNode }) {
  const {
    cloud,
    role,
    setRole,
    screen,
    setScreen,
    studio,
    me,
    canGoBack,
    goBack,
    unreadChat,
    unreadNotices,
    pendingMoves,
  } = useStore()
  const tabs = role === 'teacher' ? TEACHER_TABS : STUDENT_TABS
  const nav = role === 'teacher' ? TEACHER_NAV : STUDENT_NAV
  const person = role === 'teacher' ? studio.teacher : me.name
  const short = role === 'teacher' ? studio.teacherShort : me.short

  const moreScreens: Screen[] = [
    'more',
    'theory',
    'article',
    'feedback',
    'places',
    'diary',
    'notices',
    'progress',
  ]
  const tabActive = (id: Screen) =>
    screen === id ||
    (id === 'chat' && screen === 'thread') ||
    (id === 'memberships' && screen === 'student') ||
    (id === 'more' && moreScreens.includes(screen) && !(role === 'teacher' && screen === 'memberships'))

  const badgeFor = (id: Screen) => {
    if (id === 'chat') return unreadChat
    if (id === 'notices') return unreadNotices
    if (id === 'schedule' && role === 'teacher') return pendingMoves
    return 0
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">{studio.name}</div>
          <div className="brand-sub">{studio.tagline}</div>
        </div>
        <nav className="side-nav">
          {nav.map((item) => {
            const count = badgeFor(item.id)
            return (
              <button
                key={item.id}
                className={screen === item.id ? 'side-link on' : 'side-link'}
                onClick={() => setScreen(item.id)}
              >
                <Icon name={item.icon} />
                <span className="grow">{item.label}</span>
                {count > 0 && <span className="count">{count}</span>}
              </button>
            )
          })}
        </nav>
        <div className="side-foot">
          <div className="role-meta">
            <b>{person}</b>
            <span>{role === 'teacher' ? 'педагог' : me.voice}</span>
          </div>
          {!cloud && <RoleSwitch role={role} onChange={setRole} />}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          {canGoBack && !ROOT_SCREENS.includes(screen) ? (
            <Button variant="outline" size="sm" className="rounded-xl" onClick={goBack}>
              <Icon name="back" size={16} />
              назад
            </Button>
          ) : (
            <div className="brand">
              <div className="brand-mark">{studio.name}</div>
              <div className="brand-sub">{role === 'teacher' ? 'кабинет педагога' : 'кабинет ученика'}</div>
            </div>
          )}
          <div className="topbar-right">
            {!cloud && <RoleSwitch role={role} onChange={setRole} compact />}
            <Initials text={short} />
          </div>
        </header>
        {children}
      </div>

      <nav className="bottom-nav">
        {tabs.map((t) => {
          const count = badgeFor(t.id) || (t.id === 'more' ? unreadNotices : 0)
          return (
            <button key={t.id} className={tabActive(t.id) ? 'tab on' : 'tab'} onClick={() => setScreen(t.id)}>
              <span className="tab-icon">
                <Icon name={t.icon} />
                {count > 0 && <i className="tab-dot" />}
              </span>
              {t.label}
            </button>
          )
        })}
      </nav>

      <Toaster />
    </div>
  )
}

function RoleSwitch({
  role,
  onChange,
  compact,
}: {
  role: 'teacher' | 'student'
  onChange: (role: 'teacher' | 'student') => void
  compact?: boolean
}) {
  return (
    <ToggleGroup
      type="single"
      value={role}
      onValueChange={(value) => {
        if (value === 'teacher' || value === 'student') onChange(value)
      }}
      className={compact ? 'rounded-full border border-border bg-card p-0.5' : 'rounded-full border border-border bg-card p-0.5'}
    >
      <ToggleGroupItem value="student" className="h-7 rounded-full px-3 text-xs data-[state=on]:bg-accent data-[state=on]:text-primary">
        ученик
      </ToggleGroupItem>
      <ToggleGroupItem value="teacher" className="h-7 rounded-full px-3 text-xs data-[state=on]:bg-accent data-[state=on]:text-primary">
        педагог
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
