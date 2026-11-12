import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'

const external = ['DATABASE_URL', 'DIRECT_URL', 'SUPABASE_DB_URL', 'POSTGRES_URL', 'PGHOST', 'PGSERVICE']
if (process.argv.length > 2 || external.some(key => process.env[key])) {
  console.error('RECUSADO: o runner aceita apenas o Postgres descartável que ele próprio cria.')
  process.exit(2)
}

const { default: EmbeddedPostgres } = await import('embedded-postgres')
const listener = createServer()
await new Promise((resolve, reject) => listener.once('error', reject).listen(0, '127.0.0.1', resolve))
const port = listener.address().port
await new Promise(resolve => listener.close(resolve))
const directory = await mkdtemp(join(tmpdir(), 'provador-test-'))
const password = randomUUID()
const db = new EmbeddedPostgres({
  databaseDir: join(directory, 'pg'), user: 'postgres', password, port, persistent: false,
  onLog(message) { if (process.env.TEST_PG_VERBOSE) console.error(message.trim()) }, onError: console.error,
  postgresFlags: ['-c', 'listen_addresses=127.0.0.1', '-c', 'unix_socket_directories='],
})
let pool
let started = false
let stopping = false
try {
  await db.initialise()
  await db.start().catch(error => { throw error || new Error('Postgres descartável não iniciou') })
  started = true
  pool = new pg.Pool({ host: '127.0.0.1', port, user: 'postgres', password, database: 'postgres', max: 32 })
  pool.on('error', error => { if (!stopping) { console.error(error.message); process.exitCode = 1 } })
  const read = path => readFile(new URL(path, import.meta.url), 'utf8')
  await pool.query(await read('./bootstrap.sql'))
  const migrations = (await readdir(new URL('../migrations/', import.meta.url))).filter(name => name.endsWith('.sql')).sort()
  for (const file of migrations) await pool.query(await read('../migrations/' + file))
  console.log('PASS: ' + migrations.length + ' migrations, ' + (await pool.query('show server_version')).rows[0].server_version)
  await pool.query(await read('./invariants.sql'))
  console.log('PASS: reserva, estorno, duplicidade, isolamento e crédito único')

  const { rows: [store] } = await pool.query("insert into pilot_stores(name,generation_budget) values('Concorrência',7) returning id")
  const { rows: [piece] } = await pool.query("insert into pilot_pieces(store_id,garment_url,enabled) values($1,'asset',true) returning id", [store.id])
  const requests = await Promise.all(Array.from({ length: 32 }, async () =>
    (await pool.query('select reserve_pilot_tryon($1,$2) as result', [piece.id, randomUUID()])).rows[0].result))
  assert.equal(requests.filter(Boolean).length, 7)
  assert.equal((await pool.query('select generation_budget from pilot_stores where id=$1', [store.id])).rows[0].generation_budget, 0)
  console.log('PASS: 32 sessões concorrentes, 7 reservas e saldo 0')

  await pool.query('update pilot_stores set generation_budget=40,daily_limit=40 where id=$1', [store.id])
  const budget = await Promise.all(Array.from({ length: 32 }, async () =>
    (await pool.query("select generation_reserve($1,$2,500000,70000,'gpt-image-2','low','1024x1536') as result",
      [randomUUID(), piece.id])).rows[0].result))
  assert.equal(budget.filter(row => row.status === 'allowed').length, 7)
  assert.equal(budget.filter(row => row.status === 'budget').length, 25)
  assert.equal(budget.filter(row => row.alert).length, 1)
  console.log('PASS: teto global concorrente, 7 autorizações, 25 bloqueios, 1 alerta')
  const rates = await Promise.all(Array.from({ length: 32 }, () =>
    pool.query('select generation_rate($1,5) as allowed', ['a'.repeat(64)])))
  assert.equal(rates.filter(result => result.rows[0].allowed).length, 5)
  console.log('PASS: 32 chamadas concorrentes no mesmo IP, 5 autorizadas')
} finally {
  stopping = true
  await pool?.end()
  if (started) await db.stop()
  await rm(directory, { recursive: true, force: true })
}
