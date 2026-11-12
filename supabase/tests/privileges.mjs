import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import pg from 'pg'

const productionRef = 'qislunvynxdrbclzqaoy'
const roles = ['anon', 'authenticated']

export async function inventory(db) {
  const { rows: functions } = await db.query(`
    select p.oid::regprocedure::text as signature, p.proname as name, p.prosecdef as definer,
      p.proargnames[1:p.pronargs] as args, p.pronargs as arity,
      has_function_privilege('anon',p.oid,'EXECUTE') as anon,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated,
      array(select distinct case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee)::text end
        from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where a.privilege_type='EXECUTE' order by 1) as execute
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind in ('f','p','w')
    order by signature`)
  const { rows: tables } = await db.query(`
    select c.relname as name,c.relrowsecurity as rls,
      (select a.attname from pg_attribute a where a.attrelid=c.oid and a.attnotnull
        and a.attnum>0 and not a.attisdropped order by a.attnum limit 1) as required,
      array(select v from unnest(array['SELECT','INSERT','UPDATE','DELETE']) v
        where has_table_privilege('anon',c.oid,v) or
          (v <> 'DELETE' and has_any_column_privilege('anon',c.oid,v))) as anon,
      array(select v from unnest(array['SELECT','INSERT','UPDATE','DELETE']) v
        where has_table_privilege('authenticated',c.oid,v) or
          (v <> 'DELETE' and has_any_column_privilege('authenticated',c.oid,v))) as authenticated
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') order by name`)
  return { functions, tables }
}

const known = new Set([
  'pilot_recharges', 'pilot_request_recharge', 'pilot_review_recharge', 'generation_rate',
  'generation_reserve', 'generation_finish', 'reserve_demo_tryon', 'reserve_pilot_tryon',
  'pilot_credit', 'pilot_dashboard', 'pilot_save_piece', 'pilot_toggle_piece', 'pilot_public_piece',
  'pilot_settle', 'pilot_admin_credit', 'pilot_variant', 'pilot_set_variant', 'pilot_variants',
  'pilot_admin_overview', 'pilot_admin_store',
])

function previewConfiguration(env) {
  const ref = env.PREVIEW_PROJECT_REF
  const url = new URL(env.PREVIEW_SUPABASE_URL || 'invalid:')
  const db = new URL(env.PREVIEW_DB_URL || 'invalid:')
  if (!/^[a-z0-9]{20}$/.test(ref || '') || ref === productionRef ||
      url.origin !== 'https://' + ref + '.supabase.co' || url.href !== url.origin + '/' ||
      !['postgres:', 'postgresql:'].includes(db.protocol) || db.hostname !== 'db.' + ref + '.supabase.co' ||
      db.port !== '5432' || db.pathname !== '/postgres' ||
      db.search !== '?sslmode=verify-full') {
    throw new Error('Use exclusivamente a URL HTTPS e a conexão direta TLS verify-full do mesmo Supabase novo de Preview.')
  }
  const key = env.PREVIEW_SUPABASE_ANON_KEY
  const jwt = env.PREVIEW_USER_JWT
  const parse = value => JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString())
  if (!key || parse(key).role !== 'anon' || parse(key).ref !== ref ||
      !jwt || parse(jwt).role !== 'authenticated' || parse(jwt).iss !== url.origin + '/auth/v1') {
    throw new Error('Forneça a chave anon legada e o access_token de um usuário comum do Preview.')
  }
  return { url: url.origin, db: db.href, key, jwt }
}

async function run() {
  const config = previewConfiguration(process.env)
  const headers = token => ({ apikey: config.key, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' })
  const response = await fetch(config.url + '/auth/v1/user', { headers: headers(config.jwt), signal: AbortSignal.timeout(10000) })
  if (!response.ok) throw new Error('JWT do Preview inválido ou expirado.')
  const user = await response.json()

  const db = new pg.Client({ connectionString: config.db, connectionTimeoutMillis: 10000, statement_timeout: 10000 })
  await db.connect()
  try {
    const operator = await db.query('select 1 from public.pilot_operators where user_id=$1', [user.id])
    if (operator.rowCount) throw new Error('Use uma conta comum, sem papel de operador.')
    const { functions, tables } = await inventory(db)
    if (!functions.length || !tables.length) throw new Error('Schema de Preview vazio.')
    let failures = 0
    function report(ok, description) {
      console.log((ok ? 'PASS ' : 'FAIL ') + description)
      if (!ok) failures++
    }
    async function probe(role, path, method, body, rpc = false, granted = false) {
      const token = role === 'anon' ? config.key : config.jwt
      const result = await fetch(config.url + '/rest/v1/' + path, {
        method, headers: headers(token), body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(10000), redirect: 'error',
      })
      const error = result.ok ? null : await result.json().catch(() => null)
      const code = error?.code
      const denied = ([401, 403].includes(result.status) && code === '42501') ||
        (rpc && !granted && result.status === 404 && code === 'PGRST202')
      report(!granted && denied, [role, method, path, result.status, code || '-'].join(' '))
    }

    for (const fn of functions) {
      console.log(fn.signature + ' SECURITY ' + (fn.definer ? 'DEFINER' : 'INVOKER') + ' EXECUTE: ' + fn.execute.join(', '))
      const overload = functions.filter(item => item.name === fn.name).length > 1
      if (!known.has(fn.name) || overload || (fn.args?.length ?? 0) !== fn.arity) {
        report(false, 'RPC sem fixture segura: ' + fn.signature)
        continue
      }
      const args = Object.fromEntries(fn.args.map(name => [name, null]))
      // UUID inexistente garante que rotas de alteração não alcancem dados reais.
      for (const name of ['p_actor', 'p_owner', 'p_store', 'p_piece', 'p_request', 'piece_id']) {
        if (name in args) args[name] = randomUUID()
      }
      for (const role of roles) await probe(role, 'rpc/' + fn.name, 'POST', args, true, fn[role])
    }
    for (const table of tables) {
      report(table.rls, 'RLS ' + table.name)
      if (!table.required || !/^[a-z_][a-z0-9_]*$/i.test(table.required)) {
        report(false, 'Tabela sem coluna NOT NULL segura para sonda: ' + table.name)
        continue
      }
      const path = encodeURIComponent(table.name)
      const miss = path + '?' + table.required + '=is.null'
      const payload = { [table.required]: null }
      for (const role of roles) {
        await probe(role, path + '?limit=0', 'GET', undefined, false, table[role].includes('SELECT'))
        await probe(role, path, 'POST', payload, false, table[role].includes('INSERT'))
        await probe(role, miss, 'PATCH', payload, false, table[role].includes('UPDATE'))
        await probe(role, miss, 'DELETE', undefined, false, table[role].includes('DELETE'))
      }
    }
    console.log('Inventário: ' + functions.length + ' RPCs, ' + tables.length + ' tabelas, ' + failures + ' falhas.')
    if (failures) process.exitCode = 1
  } finally {
    await db.end()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run().catch(error => {
    console.error('Auditoria não concluída:', error.code || error.message)
    process.exitCode = 1
  })
}
