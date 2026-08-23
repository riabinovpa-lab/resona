/**
 * Прогон схемы на настоящем Postgres (в WASM) до того, как она попадёт в боевую базу.
 *
 * Здесь нет Supabase, поэтому его часть подменяется заглушками: схема auth,
 * роли и auth.uid(), который читает текущего «вошедшего» из настройки сессии.
 * Проверяем не синтаксис ради синтаксиса, а правила: списание с абонемента,
 * запрет на чужой урок, срок переноса, недоступность чужих данных.
 *
 * Запуск: node supabase/check.mjs
 */

import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const db = await PGlite.create()

let failures = 0
const ok = (name) => console.log(`  ok   ${name}`)
const bad = (name, detail) => {
  failures++
  console.log(`  FAIL ${name}\n       ${detail}`)
}

async function expectOk(name, run) {
  try {
    await run()
    ok(name)
  } catch (e) {
    bad(name, e.message)
  }
}

/** Ожидаем именно отказ: правило должно жить в базе, а не только в интерфейсе. */
async function expectFail(name, needle, run) {
  try {
    await run()
    bad(name, 'ожидали отказ, но всё прошло')
  } catch (e) {
    if (needle && !e.message.includes(needle)) bad(name, `другая ошибка: ${e.message}`)
    else ok(name)
  }
}

/**
 * RLS не спорит с запретным UPDATE, а просто не находит для него строк: запрос
 * «проходит», не изменив ничего. Поэтому проверяем не ошибку, а данные.
 */
async function expectNoChange(name, read, run) {
  const before = JSON.stringify(await read())
  try {
    await run()
  } catch {
    // Явный отказ тоже годится.
  }
  const after = JSON.stringify(await read())
  if (before === after) ok(name)
  else bad(name, `было ${before}, стало ${after}`)
}

// Роль переключаем на весь сеанс, а не на транзакцию: PGlite выполняет каждый
// запрос в своей, и set local сбросился бы обратно на суперпользователя,
// который RLS не подчиняется.
const asUser = (id) => db.exec(`set role authenticated; set resona.uid = '${id}';`)
const asAdmin = () => db.exec(`reset role; set resona.uid = '';`)

console.log('\nПодготовка: заглушки Supabase')

await db.exec(`
  create role anon;
  create role authenticated;
  create role service_role;
  create schema auth;

  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    created_at timestamptz not null default now()
  );

  -- В Supabase auth.uid() читает id из JWT. Здесь — из настройки сессии.
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('resona.uid', true), '')::uuid;
  $$;

  -- Публикации для реалтайма в PGlite нет: создаём пустую, чтобы миграция прошла.
  create publication supabase_realtime;
`)

console.log('Миграция')

const migration = readFileSync(new URL('./migrations/0001_init.sql', import.meta.url), 'utf8')
try {
  await db.exec(migration)
  ok('0001_init.sql применилась')
} catch (e) {
  bad('0001_init.sql применилась', e.message)
  console.log('\nДальше идти нет смысла.')
  process.exit(1)
}

// Права здесь не выдаём: их обязана выдать сама миграция. Когда они дописывались
// тут, тест не замечал, что в боевой базе роль authenticated осталась без доступа.

console.log('Сид')

const seed = readFileSync(new URL('./seed.sql', import.meta.url), 'utf8')
await expectOk('seed.sql применился', () => db.exec(seed))

const students = await db.query('select id, name, invite_code from public.students order by name')
await expectOk('десять учеников на месте', async () => {
  if (students.rows.length !== 10) throw new Error(`их ${students.rows.length}`)
})
await expectOk('у каждого свой код приглашения', async () => {
  const codes = new Set(students.rows.map((r) => r.invite_code))
  if (codes.size !== 10) throw new Error(`уникальных кодов ${codes.size}`)
  if ([...codes].some((c) => !/^[ACDEFGHJKLMNPQRTUVWXY34679]{6}$/.test(c))) {
    throw new Error(`код не той формы: ${[...codes][0]}`)
  }
})

console.log('\nРоли: первый вошедший — педагог')

const teacher = (await db.query(`insert into auth.users (email) values ('adel@example.com') returning id`)).rows[0].id
const pupil = (await db.query(`insert into auth.users (email) values ('nastya@example.com') returning id`)).rows[0].id
const stranger = (await db.query(`insert into auth.users (email) values ('kto@example.com') returning id`)).rows[0].id

await expectOk('педагогом стал первый', async () => {
  const r = await db.query(`select role from public.profiles where id = $1`, [teacher])
  if (r.rows[0].role !== 'teacher') throw new Error(`роль ${r.rows[0].role}`)
})
await expectOk('второй вошёл учеником', async () => {
  const r = await db.query(`select role, student_id from public.profiles where id = $1`, [pupil])
  if (r.rows[0].role !== 'student') throw new Error(`роль ${r.rows[0].role}`)
  if (r.rows[0].student_id !== null) throw new Error('карточка привязалась сама')
})

console.log('\nКод приглашения')

const nastya = students.rows.find((r) => r.name === 'Самарина Настя')

await asUser(pupil)
await expectFail('чужой код не подходит', 'Код не найден', () =>
  db.query(`select public.claim_invite('ZZZZZZ')`),
)
await expectOk('свой код связывает карточку', () => db.query(`select public.claim_invite($1)`, [nastya.invite_code]))
await expectFail('повторно тем же кодом нельзя', 'Код не найден', () =>
  db.query(`select public.claim_invite($1)`, [nastya.invite_code]),
)

await asUser(teacher)
await expectFail('педагогу код не нужен', 'Педагогу код не нужен', () =>
  db.query(`select public.claim_invite($1)`, [students.rows.find((r) => r.name === 'Аня').invite_code]),
)

console.log('\nЧто видит ученик')

const other = students.rows.find((r) => r.name === 'Паша')
const place = (await db.query(`select id from public.places where name = 'Петроградка'`)).rows[0].id

await asAdmin()
await db.query(
  `insert into public.lessons (student_id, starts_at, duration, focus, location_id)
   values ($1, now() + interval '3 days', 55, 'Микст', $2), ($3, now() + interval '4 days', 55, 'Репертуар', $2)`,
  [nastya.id, place, other.id],
)
await db.query(`insert into public.diary (student_id, stars, comment) values ($1, 5, 'чужая запись')`, [other.id])

await asUser(pupil)
await expectOk('видит только свою карточку', async () => {
  const r = await db.query('select id from public.students')
  if (r.rows.length !== 1 || r.rows[0].id !== nastya.id) throw new Error(`строк ${r.rows.length}`)
})
await expectOk('видит только свои уроки', async () => {
  const r = await db.query('select student_id from public.lessons')
  if (r.rows.length !== 1 || r.rows[0].student_id !== nastya.id) throw new Error(`строк ${r.rows.length}`)
})
await expectOk('чужой дневник не читается', async () => {
  const r = await db.query('select id from public.diary')
  if (r.rows.length !== 0) throw new Error(`строк ${r.rows.length}`)
})
await expectOk('занятость видна обезличенно', async () => {
  const r = await db.query('select starts_at, duration from public.busy')
  if (r.rows.length !== 2) throw new Error(`строк ${r.rows.length}`)
})
await expectOk('кабинеты и рабочие окна доступны', async () => {
  const p = await db.query('select id from public.places')
  const s = await db.query('select id from public.slots')
  if (p.rows.length !== 3 || s.rows.length !== 6) throw new Error(`кабинетов ${p.rows.length}, окон ${s.rows.length}`)
})

console.log('\nЧего ученику нельзя')

await expectNoChange(
  'дописать себе занятий',
  async () => (await db.query(`select remaining from public.students where id = $1`, [nastya.id])).rows,
  () => db.query(`update public.students set remaining = 99 where id = $1`, [nastya.id]),
)
await expectNoChange(
  'закрыть свой урок как проведённый',
  async () => (await db.query(`select status from public.lessons where student_id = $1`, [nastya.id])).rows,
  () => db.query(`update public.lessons set status = 'done' where student_id = $1`, [nastya.id]),
)
await expectNoChange(
  'завести себе урок',
  async () => (await db.query(`select count(*)::int as n from public.lessons`)).rows,
  () =>
    db.query(
      `insert into public.lessons (student_id, starts_at, duration, focus) values ($1, now(), 55, 'сам себе')`,
      [nastya.id],
    ),
)
await expectNoChange(
  'поставить себе звёзды в дневник',
  async () => (await db.query(`select count(*)::int as n from public.diary`)).rows,
  () => db.query(`insert into public.diary (student_id, stars, comment) values ($1, 5, 'сам себе')`, [nastya.id]),
)
// Вид busy работает от имени владельца и RLS не подчиняется. Postgres же считает
// простой вид из одной таблицы изменяемым, так что без явного запрета через него
// можно было бы удалять чужие уроки.
await expectNoChange(
  'удалить чужой урок через вид занятости',
  async () => {
    await db.exec('reset role')
    const rows = (await db.query(`select count(*)::int as n from public.lessons`)).rows
    await db.exec(`set role authenticated`)
    return rows
  },
  () => db.query(`delete from public.busy`),
)
await expectFail('написать от имени педагога', null, () =>
  db.query(`insert into public.messages (student_id, from_role, body) values ($1, 'teacher', 'подделка')`, [
    nastya.id,
  ]),
)
await expectFail('написать в чужую переписку', null, () =>
  db.query(`insert into public.messages (student_id, from_role, body) values ($1, 'student', 'не мой чат')`, [
    other.id,
  ]),
)
await expectOk('в свою переписку — можно', () =>
  db.query(`insert into public.messages (student_id, from_role, body) values ($1, 'student', 'здравствуйте')`, [
    nastya.id,
  ]),
)

console.log('\nЧужой аккаунт без карточки')

await asUser(stranger)
await expectOk('не видит ничего из учеников', async () => {
  const r = await db.query('select id from public.students')
  if (r.rows.length !== 0) throw new Error(`строк ${r.rows.length}`)
})
await asAdmin()
const someLesson = (await db.query(`select id from public.lessons limit 1`)).rows[0].id
await asUser(stranger)
await expectFail('не может просить перенос чужого урока', 'Профиль не связан', () =>
  db.query(`select public.request_move($1, now() + interval '5 days', '')`, [someLesson]),
)

console.log('\nПрактика и домашнее задание')

await asUser(pupil)
await expectOk('минуты практики пишутся', () => db.query(`select public.log_practice(20)`))
await expectFail('нелепое число минут отвергается', 'Недопустимое число минут', () =>
  db.query(`select public.log_practice(9000)`),
)
await expectOk('минуты попали в нужный день недели', async () => {
  const r = await db.query(`select practice_week from public.students where id = $1`, [nastya.id])
  const week = r.rows[0].practice_week
  const total = week.reduce((a, b) => a + b, 0)
  if (total !== 20) throw new Error(`в сумме ${total}: ${JSON.stringify(week)}`)
})
await expectOk('домашнее отмечается и снимается', async () => {
  const lesson = (await db.query(`select id from public.lessons limit 1`)).rows[0]
  if (!lesson) throw new Error('ученик не видит ни одного своего урока')
  const on = await db.query(`select public.toggle_homework($1) as at`, [lesson.id])
  if (!on.rows[0].at) throw new Error('не отметилось')
  const off = await db.query(`select public.toggle_homework($1) as at`, [lesson.id])
  if (off.rows[0].at) throw new Error('не снялось')
})

console.log('\nПеренос урока')

await asAdmin()
const soon = (
  await db.query(
    `insert into public.lessons (student_id, starts_at, duration, focus, location_id)
     values ($1, now() + interval '3 hours', 55, 'Срочный', $2) returning id`,
    [nastya.id, place],
  )
).rows[0].id

await asUser(pupil)
await expectFail('позже срока — только через педагога', 'меньше 12 часов', () =>
  db.query(`select public.request_move($1, now() + interval '6 days', '')`, [soon]),
)

const mine = (await db.query(`select id from public.lessons where focus = 'Микст'`)).rows[0].id
await expectOk('заявка на перенос создаётся', () =>
  db.query(`select public.request_move($1, now() + interval '6 days', 'работа')`, [mine]),
)
await expectOk('повторная заявка заменяет прежнюю', async () => {
  await db.query(`select public.request_move($1, now() + interval '7 days', 'иначе')`, [mine])
  const r = await db.query(`select count(*)::int as n from public.moves where lesson_id = $1 and status = 'pending'`, [
    mine,
  ])
  if (r.rows[0].n !== 1) throw new Error(`заявок ${r.rows[0].n}`)
})
await expectFail('решение принимает не ученик', 'Решение принимает педагог', async () => {
  const move = (await db.query(`select id from public.moves where lesson_id = $1`, [mine])).rows[0]
  return db.query(`select public.resolve_move($1, true)`, [move.id])
})

await asUser(teacher)
await expectOk('педагог переносит урок', async () => {
  const move = (await db.query(`select id, proposed_at from public.moves where status = 'pending'`)).rows[0]
  await db.query(`select public.resolve_move($1, true)`, [move.id])
  const r = await db.query(`select starts_at, series_id from public.lessons where id = $1`, [mine])
  if (+new Date(r.rows[0].starts_at) !== +new Date(move.proposed_at)) throw new Error('время не сдвинулось')
  if (r.rows[0].series_id !== null) throw new Error('урок остался в серии')
})
await expectFail('на занятое время не переносит', 'уже занято', async () => {
  const busy = (await db.query(`select starts_at from public.lessons where focus = 'Репертуар'`)).rows[0].starts_at
  const move = (
    await db.query(
      `insert into public.moves (lesson_id, student_id, proposed_at) values ($1, $2, $3) returning id`,
      [mine, nastya.id, busy],
    )
  ).rows[0].id
  return db.query(`select public.resolve_move($1, true)`, [move])
})

console.log('\nСчётчик абонемента')

await asAdmin()
const counter = async () => {
  const r = await db.query(`select remaining, used from public.students where id = $1`, [nastya.id])
  return r.rows[0]
}
const before = await counter()

await expectOk('проведённый урок списывается', async () => {
  await db.query(`update public.lessons set status = 'done' where id = $1`, [mine])
  const now = await counter()
  if (now.used !== before.used + 1 || now.remaining !== before.remaining - 1) {
    throw new Error(`было ${JSON.stringify(before)}, стало ${JSON.stringify(now)}`)
  }
})
await expectOk('пропуск списывается так же', async () => {
  await db.query(`update public.lessons set status = 'missed' where id = $1`, [mine])
  const now = await counter()
  if (now.used !== before.used + 1) throw new Error(`used ${now.used}`)
})
await expectOk('отмена возвращает занятие', async () => {
  await db.query(`update public.lessons set status = 'cancelled' where id = $1`, [mine])
  const now = await counter()
  if (now.used !== before.used || now.remaining !== before.remaining) {
    throw new Error(`было ${JSON.stringify(before)}, стало ${JSON.stringify(now)}`)
  }
})
await expectOk('удаление проведённого тоже возвращает', async () => {
  await db.query(`update public.lessons set status = 'done' where id = $1`, [mine])
  await db.query(`delete from public.lessons where id = $1`, [mine])
  const now = await counter()
  if (now.used !== before.used || now.remaining !== before.remaining) {
    throw new Error(`было ${JSON.stringify(before)}, стало ${JSON.stringify(now)}`)
  }
})
await expectOk('остаток не уходит в минус', async () => {
  const zero = students.rows.find((r) => r.name === 'Ирина')
  const lesson = (
    await db.query(
      `insert into public.lessons (student_id, starts_at, duration, focus, status, location_id)
       values ($1, now() + interval '1 day', 55, 'Долг', 'done', $2) returning id`,
      [zero.id, place],
    )
  ).rows[0].id
  const r = await db.query(`select remaining from public.students where id = $1`, [zero.id])
  if (r.rows[0].remaining < 0) throw new Error(`остаток ${r.rows[0].remaining}`)
  await db.query(`delete from public.lessons where id = $1`, [lesson])
})

console.log('\nСчётчики просмотра')

await asUser(pupil)
await expectOk('отметка «прочитано» пишется', async () => {
  await db.query(`select public.mark_seen('chat')`)
  const r = await db.query(`select chat from public.seen where profile_id = $1`, [pupil])
  if (+new Date(r.rows[0].chat) < Date.now() - 60000) throw new Error('время не обновилось')
})
await expectFail('чужой счётчик не пишется', 'Неизвестный счётчик', () => db.query(`select public.mark_seen('всё')`))

console.log(failures === 0 ? '\nВсё сходится.\n' : `\nПровалов: ${failures}\n`)
process.exit(failures === 0 ? 0 : 1)
