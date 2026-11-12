import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'
import { rpc } from './server.js'

const ACTION = 'provador'
const TEST_SECRET = '1x0000000000000000000000000000000AA'

function integer(name, fallback, max) {
  const value = Number(process.env[name] ?? fallback)
  if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new Error('Invalid generation limit')
  return value
}

export function generationLimits() {
  return {
    daily: integer('OPENAI_DAILY_BUDGET_MICRO_USD', 5_000_000, 1_000_000_000_000),
    unit: integer('OPENAI_ASSUMED_COST_MICRO_USD', 70_000, 1_000_000_000),
    rate: integer('TRYON_IP_PER_MINUTE', 5, 1000),
  }
}

export async function checkRate(request, limit) {
  const ip = process.env.VERCEL === '1'
    ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim()
    : process.env.NODE_ENV !== 'production' ? '127.0.0.1' : null
  const secret = process.env.TRYON_IP_HASH_SECRET
  if (!ip || !isIP(ip) || !secret || secret.length < 32) throw new Error('IP guard not configured')
  const hash = createHmac('sha256', secret).update(ip).digest('hex')
  return rpc('generation_rate', { p_ip: hash, p_limit: limit })
}

export async function verifyTurnstile(token, hostname) {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret || (process.env.VERCEL_ENV === 'production' && secret === TEST_SECRET)) {
    throw new Error('Turnstile not configured')
  }
  if (typeof token !== 'string' || !token || token.length > 2048) return false
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body: new URLSearchParams({ secret, response: token }),
    signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) throw new Error('Turnstile unavailable')
  const result = await response.json()
  if (secret === TEST_SECRET && process.env.VERCEL_ENV !== 'production') {
    return result.success === true && result.hostname === 'example.com'
  }
  return result.success === true && result.hostname === hostname && result.action === ACTION
}

export async function sendBudgetAlert(reservation, limit) {
  if (!reservation.alert) return
  const event = { event: 'openai_budget_80_percent', day: reservation.day, reservedMicroUsd: reservation.reserved, limitMicroUsd: limit }
  console.warn(JSON.stringify(event))
  const webhook = process.env.TRYON_BUDGET_ALERT_WEBHOOK_URL
  if (!webhook) return
  try {
    const response = await fetch(webhook, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event), signal: AbortSignal.timeout(3000),
    })
    if (!response.ok) throw new Error('Webhook refused alert')
  } catch {
    console.error(JSON.stringify({ event: 'openai_budget_alert_delivery_failed', day: reservation.day }))
  }
}
