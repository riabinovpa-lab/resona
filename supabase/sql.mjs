/**
 * Выполняет произвольный запрос к базе проекта по HTTPS.
 *
 * Нужен потому, что протокол Postgres проходит не из всякой сети, а посмотреть
 * в базу иногда надо: кто зарегистрировался, какие коды остались неиспользованными.
 *
 * Запуск: node --env-file-if-exists=.env supabase/sql.mjs "select count(*) from students"
 *         node --env-file-if-exists=.env supabase/sql.mjs --file supabase/seed.sql
 */

import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const fileAt = args.indexOf('--file')
const query = fileAt === -1 ? args.join(' ') : readFileSync(args[fileAt + 1], 'utf8')

const token = process.env.SUPABASE_ACCESS_TOKEN
const projectUrl = process.env.VITE_SUPABASE_URL

if (!query.trim()) {
  console.error('Нечего выполнять: передайте запрос или --file путь')
  process.exitCode = 1
} else if (!token || !projectUrl) {
  console.error('Нужны SUPABASE_ACCESS_TOKEN и VITE_SUPABASE_URL в .env')
  process.exitCode = 1
} else {
  const ref = new URL(projectUrl).hostname.split('.')[0]
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })

  const body = await response.text()
  if (!response.ok) {
    let why = body.slice(0, 800)
    try {
      why = JSON.parse(body).message ?? why
    } catch {
      /* ответ не в JSON */
    }
    console.error(`Отказ (${response.status}): ${why}`)
    process.exitCode = 1
  } else {
    const rows = JSON.parse(body)
    if (!Array.isArray(rows) || !rows.length) console.log('(пусто)')
    else console.table(rows)
  }
}
