/**
 * Применяет схему и сид к боевой базе.
 *
 * Два способа доставки, потому что первый доступен не из всякой сети.
 *
 *   HTTPS  — нужен личный токен из Supabase (Account → Access Tokens) в
 *            SUPABASE_ACCESS_TOKEN. Идёт через api.supabase.com на 443 порт.
 *   прямой — нужна строка подключения в SUPABASE_DB_URL. Быстрее и без токена,
 *            но требует, чтобы сеть пропускала протокол Postgres на 5432.
 *
 * Если ни то, ни другое не проходит, соберите файл для ручной вставки в
 * SQL Editor: node supabase/apply.mjs --print --reset --seed
 *
 * Флаги: --seed добавляет стартовые данные, --reset начисто сносит схему public.
 */

import { readFileSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const has = (flag) => args.includes(flag)

const withSeed = has('--seed')
const withReset = has('--reset')
const toFile = has('--print')

const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8')

/**
 * Миграция создаёт таблицы без «if not exists»: повторный запуск по живой схеме
 * должен падать, а не молча дописывать половину. Поэтому чистый лист — отдельным
 * шагом и по явной просьбе.
 */
const RESET = `-- Начисто: схема public и триггер, который живёт в чужой схеме auth.
drop trigger if exists on_auth_user_created on auth.users;
drop schema if exists public cascade;
create schema public;
grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to postgres;
`

const parts = []
if (withReset) parts.push(RESET)
parts.push(read('./migrations/0001_init.sql'))
if (withSeed) parts.push(read('./seed.sql'))
const sql = parts.join('\n\n')

/** Последний запрос сида отдаёт коды приглашений — их надо разослать ученикам. */
function showCodes(rows) {
  if (!Array.isArray(rows) || !rows.length || !('invite_code' in rows[0])) return
  console.log('\nКоды приглашений:')
  for (const row of rows) console.log(`  ${row.invite_code}  ${row.name}`)
}

async function overHttps(token) {
  const projectUrl = process.env.VITE_SUPABASE_URL
  if (!projectUrl) throw new Error('Нет VITE_SUPABASE_URL: из него берётся идентификатор проекта')
  const ref = new URL(projectUrl).hostname.split('.')[0]

  console.log(`Проект ${ref}, через HTTPS`)
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })

  const body = await response.text()
  if (!response.ok) {
    let why = body.slice(0, 800)
    try {
      why = JSON.parse(body).message ?? why
    } catch {
      /* ответ не в JSON — покажем как есть */
    }
    throw new Error(`сервер отказал (${response.status}): ${why}`)
  }

  console.log('Схема применилась')
  try {
    showCodes(JSON.parse(body))
  } catch {
    /* ответ без строк — это нормально */
  }
}

async function direct(dbUrl) {
  const pg = (await import('pg')).default
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    console.log((await client.query('select version()')).rows[0].version.split(',')[0])
    const rows = (await client.query(sql)).rows ?? []
    console.log('Схема применилась')
    showCodes(rows)
  } finally {
    await client.end().catch(() => {})
  }
}

// Без process.exit: он рвёт ещё не закрытые сетевые хендлы, и Node падает с
// ассертом libuv уже после успешной работы.
try {
  if (toFile) {
    const out = new URL('./setup.sql', import.meta.url)
    writeFileSync(
      out,
      `-- Собрано автоматически: node supabase/apply.mjs --print${withReset ? ' --reset' : ''}${withSeed ? ' --seed' : ''}\n` +
        `-- Вставьте целиком в SQL Editor проекта и запустите один раз.\n\n${sql}`,
    )
    console.log(`Собрал ${out.pathname.slice(1)} — вставьте его в SQL Editor`)
  } else if (process.env.SUPABASE_ACCESS_TOKEN) {
    await overHttps(process.env.SUPABASE_ACCESS_TOKEN)
  } else if (process.env.SUPABASE_DB_URL) {
    await direct(process.env.SUPABASE_DB_URL)
  } else {
    throw new Error('Нужен SUPABASE_ACCESS_TOKEN (через HTTPS) или SUPABASE_DB_URL (напрямую)')
  }
} catch (e) {
  console.error(`\nНе получилось: ${e.message}`)
  process.exitCode = 1
}
