/**
 * Сквозная проверка на живом проекте: заводит два аккаунта, ходит от их имени
 * через PostgREST и убирает следы за собой. Проверяет то, чего не видно на
 * локальном Postgres: триггер на регистрацию, права через PostgREST, вид busy.
 *
 * Запускается только на проекте без живых аккаунтов, и это не придирка:
 * педагогом становится первый зарегистрировавшийся, так что на обжитом проекте
 * тест отобрал бы роль у настоящего педагога. Проверка на пустоту ниже.
 *
 * Запуск: npm run check:live
 */

const base = process.env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY
const token = process.env.SUPABASE_ACCESS_TOKEN
const ref = new URL(base).hostname.split('.')[0]

/**
 * Сеть здесь иногда убивает соединение посередине ответа, и повтор отличает
 * настоящую поломку от обрыва канала. Тело ответа читается тут же, внутри
 * попытки: обрыв чаще всего вылезает именно на чтении, а не на самом запросе,
 * и повтор вокруг одного fetch его не поймает.
 *
 * Ответ ждём с ограничением по времени: оборванный запрос иногда не падает,
 * а просто висит, и без срока тест зависнет вместо того, чтобы повторить.
 */
async function ask(url, init = {}) {
  for (let attempt = 1; ; attempt++) {
    const stop = AbortSignal.timeout(15000)
    try {
      const response = await fetch(url, { ...init, signal: stop })
      return { status: response.status, ok: response.ok, text: await response.text() }
    } catch (e) {
      if (attempt > 3) throw e
      console.log(`  (обрыв связи, повтор: ${e.message})`)
      await new Promise((done) => setTimeout(done, 700))
    }
  }
}

/** Ответ бывает пустым, а бывает и не в JSON: у ошибок PostgREST это важно видеть. */
function parse(text) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

let failed = 0
const check = (ok, what, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'ПЛОХО'} ${what}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed++
}

/** Запрос к базе с правами администратора: для подготовки и уборки. */
async function admin(query) {
  const r = await ask(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!r.ok) throw new Error(`админский запрос отказал: ${r.text.slice(0, 300)}`)
  return parse(r.text)
}

async function signUp(email, password) {
  const r = await ask(`${base}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body = parse(r.text)
  if (!r.ok || !body?.access_token) throw new Error(`регистрация ${email}: ${r.text.slice(0, 300)}`)
  return body.access_token
}

/** Запрос от имени вошедшего человека: именно так ходит приложение. */
async function as(jwt, path, init = {}) {
  const r = await ask(`${base}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: anon,
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...init.headers,
    },
  })
  return { status: r.status, body: parse(r.text) }
}

const rpc = (jwt, name, args) => as(jwt, `rpc/${name}`, { method: 'POST', body: JSON.stringify(args) })

/** Короткая расшифровка ответа: без неё непонятно, почему проверка не прошла. */
const brief = (res) => `HTTP ${res.status}, ${JSON.stringify(res.body).slice(0, 160)}`

const teacherMail = `probe-teacher-${Date.now()}@example.com`
const studentMail = `probe-student-${Date.now()}@example.com`
let victim = null // ученик, чей код мы израсходуем

try {
  const [{ n: accounts }] = await admin(`select count(*)::int as n from auth.users`)
  if (accounts > 0) {
    throw new Error(
      `в проекте уже ${accounts} аккаунт(ов). Тест забирает роль педагога себе, ` +
        `поэтому на обжитом проекте не запускается`,
    )
  }

  // Код приглашения одноразовый: запомним его, чтобы вернуть после проверки.
  const [pick] = await admin(`select id, name, invite_code from students where name = 'Аня'`)
  victim = pick
  if (!victim?.invite_code) throw new Error('у Ани нет кода: сид не применялся?')

  console.log('Педагог')
  const teacher = await signUp(teacherMail, 'probe-pass-1')
  check(true, 'зарегистрировался, сессия выдана сразу', 'значит подтверждение почты выключено')

  const profile = await as(teacher, 'profiles?select=role,student_id')
  check(profile.body?.[0]?.role === 'teacher', 'первый аккаунт стал педагогом', brief(profile))

  const all = await as(teacher, 'students?select=id,name')
  check(Array.isArray(all.body) && all.body.length === 10, 'видит всех учеников', brief(all))
  if (!Array.isArray(all.body)) throw new Error('без списка учеников дальше проверять нечего')

  const places = await as(teacher, 'places?select=id')
  check(places.body?.length === 3, 'видит кабинеты', brief(places))

  const seen = await rpc(teacher, 'mark_seen', { p_key: 'chat' })
  check(seen.status < 300, 'отметка прочитанного работает', `HTTP ${seen.status}`)

  // Урок нужен, чтобы проверить, что ученик видит занятость, но не чужие уроки.
  const other = all.body.find((s) => s.name !== 'Аня')
  const lesson = await as(teacher, 'lessons', {
    method: 'POST',
    body: JSON.stringify({
      student_id: other.id,
      starts_at: new Date(Date.now() + 4 * 86400000).toISOString(),
      duration: 60,
      focus: 'проверка',
    }),
  })
  check(lesson.status < 300, 'педагог ставит урок', `HTTP ${lesson.status}`)

  const burned = await admin(`select remaining, used from students where id = '${other.id}'`)
  check(true, 'счётчик абонемента после урока', `осталось ${burned[0].remaining}, проведено ${burned[0].used}`)

  console.log('\nУченик')
  const student = await signUp(studentMail, 'probe-pass-2')
  const blind = await as(student, 'students?select=id')
  check(blind.body?.length === 0, 'до ввода кода не видит ничего', brief(blind))

  const claim = await rpc(student, 'claim_invite', { p_code: victim.invite_code })
  check(claim.status < 300 && claim.body === victim.id, 'код привязал карточку', brief(claim))

  const mine = await as(student, 'students?select=id,name')
  check(mine.body?.length === 1 && mine.body[0]?.name === 'Аня', 'видит только свою карточку', brief(mine))

  const busy = await as(student, 'busy?select=starts_at,duration')
  check(busy.body?.length === 1, 'видит занятое время без чужих подробностей', brief(busy))

  // Условие обязательно: без него PostgREST отклонит запрос сам, и до проверки
  // прав дело не дойдёт — проверка окажется бессмысленной.
  const wipe = await as(student, 'busy?duration=gt.0', { method: 'DELETE' })
  const shift = await as(student, 'busy?duration=gt.0', { method: 'PATCH', body: JSON.stringify({ duration: 5 }) })
  const lessonsLeft = await admin(`select count(*)::int as n, min(duration) as d from public.lessons`)
  check(
    lessonsLeft[0].n === 1 && lessonsLeft[0].d === 60,
    'через вид занятости чужой урок не тронуть',
    `удаление ${brief(wipe)}; правка ${brief(shift)}`,
  )

  const foreign = await as(student, `lessons?select=id`)
  check(foreign.body?.length === 0, 'чужих уроков не видит', brief(foreign))

  const cheat = await as(student, `students?id=eq.${victim.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ remaining: 99 }),
  })
  check(
    cheat.status >= 400 || cheat.body?.length === 0,
    'дописать себе занятий не может',
    `HTTP ${cheat.status}, изменено ${Array.isArray(cheat.body) ? cheat.body.length : '?'}`,
  )

  const twice = await rpc(student, 'claim_invite', { p_code: victim.invite_code })
  check(twice.status >= 400, 'использованный код больше не работает', `HTTP ${twice.status}`)

  const secondCode = await rpc(student, 'claim_invite', { p_code: 'NETAKOY' })
  check(secondCode.status >= 400, 'чужой код не подходит', `HTTP ${secondCode.status}`)
} catch (e) {
  console.error(`\nСорвалось: ${e.message}`)
  failed++
} finally {
  console.log('\nУборка')
  try {
    await admin(`delete from public.lessons where focus = 'проверка'`)
    await admin(`delete from auth.users where email in ('${teacherMail}', '${studentMail}')`)
    if (victim) {
      await admin(`update public.students set invite_code = '${victim.invite_code}' where id = '${victim.id}'`)
    }
    const left = await admin(`
      select (select count(*) from auth.users) as аккаунты,
             (select count(*) from public.profiles) as профили,
             (select count(*) from public.lessons) as уроки,
             (select count(*) from public.students where invite_code is null) as без_кода
    `)
    console.log(`  осталось: ${JSON.stringify(left[0])}`)
  } catch (e) {
    console.error(`  убрать не удалось: ${e.message}`)
    failed++
  }

  console.log(failed ? `\nПроблем: ${failed}` : '\nВсё сошлось')
  process.exitCode = failed ? 1 : 0
}
