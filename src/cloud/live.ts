import type { SupabaseClient } from '@supabase/supabase-js'

const TABLES = [
  'students',
  'lessons',
  'slots',
  'moves',
  'messages',
  'notices',
  'diary',
  'places',
  'feedback',
] as const

/**
 * На любое изменение перечитываем состояние целиком, а не склеиваем отдельные строки.
 * Данных на студию мало, зато нет расхождений: применять по одной строке пришлось бы
 * повторять серверную логику на клиенте — и однажды разойтись с ней.
 */
export function subscribe(db: SupabaseClient, reload: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined

  // Одно действие часто задевает несколько таблиц: перенос меняет и урок, и заявку.
  const nudge = () => {
    clearTimeout(timer)
    timer = setTimeout(reload, 250)
  }

  const channel = db.channel('resona-live')
  for (const table of TABLES) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, nudge)
  }
  channel.subscribe()

  return () => {
    clearTimeout(timer)
    void db.removeChannel(channel)
  }
}
