import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item'
import { SoftCard } from '../components/app-ui'
import { Icon } from '../components/Icons'
import { useStore } from '../store-context'
import type { IconName, Screen } from '../types'

type Row = { id: Screen; title: string; sub: string; icon: IconName; badge?: number }

export function More() {
  const {
    cloud,
    accountEmail,
    signOut,
    role,
    setScreen,
    notices,
    unreadNotices,
    unreadChat,
    resetDemo,
    studio,
    students,
    lessons,
  } = useStore()
  const [confirm, setConfirm] = useState(false)

  const items: Row[] =
    role === 'teacher'
      ? [
          { id: 'notices', title: 'Рассылка всем', sub: `${notices.length} объявлений`, icon: 'bell' },
          { id: 'diary', title: 'Дневник учеников', sub: 'Комментарии и звёзды', icon: 'star' },
          { id: 'places', title: 'Кабинеты', sub: 'Адреса и как пройти', icon: 'pin' },
          { id: 'feedback', title: 'Отзывы учеников', sub: 'Их оценка занятий', icon: 'star' },
          { id: 'theory', title: 'Теория', sub: 'Тексты, которые видят ученики', icon: 'book' },
        ]
      : [
          { id: 'progress', title: 'Прогресс', sub: 'Диапазон, навыки, репертуар', icon: 'chart' },
          { id: 'diary', title: 'Мой дневник', sub: `Комментарии и звёзды · ${studio.teacher}`, icon: 'star' },
          { id: 'notices', title: 'Объявления', sub: 'Рассылка студии', icon: 'bell', badge: unreadNotices },
          { id: 'places', title: 'Где кабинет', sub: 'Адрес и как пройти', icon: 'pin' },
          { id: 'memberships', title: 'Абонемент', sub: 'Остаток занятий и прайс', icon: 'card' },
          { id: 'theory', title: 'Теория', sub: 'Опора, резонаторы, пассаж', icon: 'book' },
          { id: 'feedback', title: 'Отзыв об уроке', sub: 'Что было понятно, что нет', icon: 'star' },
        ]

  return (
    <section>
      <h1 className="page-title">Ещё</h1>
      <p className="lede">Разделы, которые не нужны в нижнем меню каждый день.</p>

      <SoftCard className="p-2">
        <ItemGroup>
          {items.map((item) => (
            <Item key={item.id} asChild size="sm" className="cursor-pointer">
              <button type="button" onClick={() => setScreen(item.id)}>
                <ItemMedia className="text-muted-foreground">
                  <Icon name={item.icon} />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{item.title}</ItemTitle>
                  <ItemDescription>{item.sub}</ItemDescription>
                </ItemContent>
                {!!item.badge && <span className="count">{item.badge}</span>}
              </button>
            </Item>
          ))}
          {unreadChat > 0 && (
            <Item asChild size="sm" className="cursor-pointer">
              <button type="button" onClick={() => setScreen('chat')}>
                <ItemMedia className="text-muted-foreground">
                  <Icon name="chat" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>
                    {role === 'teacher' ? 'Переписка с учениками' : `Переписка · ${studio.teacher}`}
                  </ItemTitle>
                  <ItemDescription>новые сообщения</ItemDescription>
                </ItemContent>
                <span className="count">{unreadChat}</span>
              </button>
            </Item>
          )}
        </ItemGroup>
      </SoftCard>

      <div className="section-h">
        <h3>{cloud ? 'Аккаунт' : 'О приложении'}</h3>
      </div>
      <SoftCard className="p-5">
        {cloud ? (
          <>
            <p className="tiny muted">
              Вошли как {accountEmail ?? 'неизвестно кто'} · {role === 'teacher' ? 'педагог' : 'ученик'}. Данные
              общие для всей студии: {students.length} учеников, {lessons.length} уроков.
            </p>
            <Button variant="outline" className="mt-3.5 rounded-xl" onClick={signOut}>
              Выйти из аккаунта
            </Button>
          </>
        ) : (
          <p className="tiny muted">
            {studio.name} — прототип на демо-данных: {students.length} учеников, {lessons.length} уроков. Всё, что вы
            меняете, сохраняется в этом браузере, сервера пока нет.
          </p>
        )}
        {!cloud && (
          <AlertDialog open={confirm} onOpenChange={setConfirm}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="mt-3.5 rounded-xl">
                Сбросить мои изменения
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Вернуть демо-данные?</AlertDialogTitle>
                <AlertDialogDescription>
                  Локальные правки в этом браузере пропадут. Расписание, дневник и переписка снова станут как в прототипе.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction onClick={resetDemo}>Да, вернуть демо</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </SoftCard>
    </section>
  )
}
