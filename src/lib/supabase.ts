import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Без ключей приложение работает на демо-данных в localStorage — так его можно показать без сервера. */
export const isCloud = Boolean(url && key)

/**
 * Запрос с повтором. Соединение до Supabase иногда умирает посередине ответа:
 * запрос не получает отказа, а просто обрывается или молча висит. Один такой
 * обрыв не должен превращаться в пустой экран, поэтому пробуем ещё раз.
 *
 * Повторяем только чтения и только сетевые сбои. Отказ сервера — это ответ,
 * его возвращаем как есть: повторять отклонённое бессмысленно. Повторять же
 * запись опасно — второй попыткой можно отправить сообщение дважды.
 */
async function persistent(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase()
  const retryable = method === 'GET' || method === 'HEAD'
  const attempts = retryable ? 3 : 1

  for (let attempt = 1; ; attempt++) {
    // Срок ждём через AbortController, а не через AbortSignal.timeout и any:
    // тех двух нет в браузерах старше пары лет, а приложение открывают с любых
    // телефонов. Отсутствие такой мелочи роняет первый же запрос — и человек
    // видит вечную загрузку вместо приложения.
    const control = new AbortController()
    // Обычный ответ приходит быстрее секунды, так что десять — это уже обрыв.
    const bell = setTimeout(() => control.abort(), 10000)
    const relay = () => control.abort()
    init?.signal?.addEventListener('abort', relay)

    try {
      return await fetch(input, { ...init, signal: control.signal })
    } catch (error) {
      // Отмену снаружи уважаем: экран уже закрыт, повторять нечего.
      if (init?.signal?.aborted || attempt >= attempts) throw error
      await new Promise((done) => setTimeout(done, 500 * attempt))
    } finally {
      clearTimeout(bell)
      init?.signal?.removeEventListener('abort', relay)
    }
  }
}

export const supabase = isCloud ? createClient(url!, key!, { global: { fetch: persistent } }) : null

/** У ошибок Postgres человеческий текст лежит в message: наши RPC пишут его по-русски. */
export function errorText(error: unknown): string {
  if (!error) return 'Неизвестная ошибка'
  if (typeof error === 'string') return error
  const message = (error as { message?: string }).message
  return message && message.trim() ? message : 'Сервер не ответил'
}
