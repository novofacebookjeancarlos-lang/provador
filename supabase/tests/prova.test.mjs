import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import sharp from 'sharp'
import { POST } from '../../app/api/prova/route.js'

const jpeg = await sharp({ create: { width: 12, height: 12, channels: 3, background: 'red' } }).jpeg().toBuffer()
Object.assign(process.env, {
  OPENAI_API_KEY: 'fake', SUPABASE_SERVICE_ROLE_KEY: 'fake', SUPABASE_URL: 'https://db.invalid',
  TURNSTILE_SECRET_KEY: 'fake', TRYON_IP_HASH_SECRET: 'a'.repeat(32),
})
delete process.env.VERCEL
delete process.env.TRYON_BUDGET_ALERT_WEBHOOK_URL

for (const mode of ['demo', 'loja']) {
  for (const scenario of ['rate', 'turnstile', 'hostname', 'budget', 'provider-error', 'allowed']) {
    test(mode + ' / ' + scenario, async t => {
      let calls = 0
      let finished
      t.mock.method(globalThis, 'fetch', async (url, options) => {
        if (url.includes('siteverify')) return Response.json({
          success: scenario !== 'turnstile', hostname: scenario === 'hostname' ? 'other.invalid' : 'local.invalid', action: 'provador',
        })
        if (url.includes('openai.com')) {
          calls++
          if (scenario === 'provider-error') return Response.json({}, { status: 502 })
          return Response.json({ data: [{ b64_json: jpeg.toString('base64') }], usage: { total_tokens: 42 } })
        }
        if (url.endsWith('/generation_rate')) return Response.json(scenario !== 'rate')
        if (url.endsWith('/pilot_public_piece')) return Response.json({ image_key: 'fixture.jpg' })
        if (url.endsWith('/fixture.jpg')) return new Response(jpeg)
        if (url.endsWith('/generation_reserve')) return Response.json({ status: scenario === 'budget' ? 'budget' : 'allowed' })
        if (url.endsWith('/generation_finish')) { finished = JSON.parse(options.body); return Response.json(null) }
        if (url.endsWith('/pilot_settle')) return Response.json(true)
        throw Error('Unexpected fetch: ' + url)
      })
      const form = new FormData()
      form.set('photo', new Blob([jpeg]), 'photo.jpg')
      form.set('garment', new Blob([jpeg]), 'garment.jpg')
      form.set('piece', mode === 'demo' ? '' : randomUUID())
      form.set('requestId', randomUUID())
      form.set('consent', 'yes')
      form.set('turnstileToken', 'mock')
      const result = await POST(new Request('https://local.invalid/api/prova', { method: 'POST', body: form }))
      assert.equal(result.status, { rate: 429, turnstile: 403, hostname: 403, budget: 503, 'provider-error': 502, allowed: 200 }[scenario])
      assert.equal(calls, ['allowed', 'provider-error'].includes(scenario) ? 1 : 0)
      if (scenario === 'provider-error') {
        assert.equal(finished.p_error, 'openai_http_502')
        assert.equal(finished.p_usage, null)
      }
      if (scenario === 'allowed') {
        assert.equal(finished.p_usage.total_tokens, 42)
        assert.equal(finished.p_error, null)
        assert.ok(finished.p_duration >= 0)
      }
    })
  }
}
