import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkRate, sendBudgetAlert, validateProductionGuard, verifyTurnstile } from '../../lib/generation-guard.js'

const secrets = [1, 2, 3].map(n => n + 'x0000000000000000000000000000000AA')

test('Turnstile: os três secrets oficiais preservam o resultado do Siteverify em Preview', async t => {
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    const index = secrets.indexOf(options.body.get('secret'))
    return Response.json(index === 0 ? { success: true, hostname: 'example.com' } : {
      success: false, 'error-codes': [index === 1 ? 'invalid-input-response' : 'timeout-or-duplicate'],
    })
  })
  process.env.VERCEL_ENV = 'preview'
  for (const [index, secret] of secrets.entries()) {
    process.env.TURNSTILE_SECRET_KEY = secret
    assert.equal(await verifyTurnstile('dummy', 'preview.invalid'), index === 0)
  }
})

test('Turnstile: secret real em Preview exige hostname e ação', async t => {
  process.env.VERCEL_ENV = 'preview'
  process.env.TURNSTILE_SECRET_KEY = 'real-fixture'
  let result
  t.mock.method(globalThis, 'fetch', async () => Response.json(result))
  for (const [hostname, action, expected] of [
    ['example.com', undefined, false], ['preview.invalid', 'outra', false],
    ['preview.invalid', 'provador', true],
  ]) {
    result = { success: true, hostname, action }
    assert.equal(await verifyTurnstile('token', 'preview.invalid'), expected)
  }
})

test('Inicialização: produção rejeita os três secrets de teste e webhook ausente', () => {
  for (const secret of secrets) assert.throws(() => validateProductionGuard({
    VERCEL_ENV: 'production', TURNSTILE_SECRET_KEY: secret, TRYON_BUDGET_ALERT_WEBHOOK_URL: 'https://hook.invalid',
  }), /real Turnstile/)
  assert.throws(() => validateProductionGuard({ VERCEL_ENV: 'production', TURNSTILE_SECRET_KEY: 'real' }), /HTTPS/)
  assert.doesNotThrow(() => validateProductionGuard({
    VERCEL_ENV: 'production', TURNSTILE_SECRET_KEY: 'real', TRYON_BUDGET_ALERT_WEBHOOK_URL: 'https://hook.invalid',
  }))
})

test('IP: x-forwarded-for forjado mantém o mesmo balde da Vercel', async t => {
  Object.assign(process.env, {
    VERCEL: '1', TRYON_IP_HASH_SECRET: 'a'.repeat(32),
    SUPABASE_URL: 'https://db.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fake',
  })
  const buckets = new Map()
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    const { p_ip, p_limit } = JSON.parse(options.body)
    const hits = (buckets.get(p_ip) || 0) + 1
    buckets.set(p_ip, hits)
    return Response.json(hits <= p_limit)
  })
  const request = forged => new Request('https://app.invalid', {
    headers: { 'x-vercel-forwarded-for': '192.0.2.42', 'x-forwarded-for': forged },
  })
  assert.equal(await checkRate(request('198.51.100.1'), 1), true)
  assert.equal(await checkRate(request('198.51.100.2'), 1), false)
  assert.equal(buckets.size, 1)
})

test('Webhook: receptor simulado recebe alerta de 80% e bloqueio 503', async t => {
  process.env.TRYON_BUDGET_ALERT_WEBHOOK_URL = 'https://receiver.invalid'
  const messages = []
  t.mock.method(console, 'warn', () => {})
  t.mock.method(globalThis, 'fetch', async (url, request) => {
    assert.equal(url, 'https://receiver.invalid')
    assert.equal(request.method, 'POST')
    assert.equal(request.headers['Content-Type'], 'application/json')
    messages.push(JSON.parse(request.body))
    return new Response(null, { status: 204 })
  })
  const base = { alert: true, day: '2026-11-12', reserved: 4_970_000 }
  await sendBudgetAlert({ ...base, status: 'allowed' }, 5_000_000)
  await sendBudgetAlert({ ...base, status: 'budget' }, 5_000_000)
  await sendBudgetAlert({ ...base, status: 'budget', alert: false }, 5_000_000)
  assert.deepEqual(messages, [
    { event: 'openai_budget_80_percent', day: base.day, reservedMicroUsd: base.reserved, limitMicroUsd: 5_000_000 },
    { event: 'openai_budget_100_percent_blocked', day: base.day, reservedMicroUsd: base.reserved, limitMicroUsd: 5_000_000, status: 503 },
  ])
})
