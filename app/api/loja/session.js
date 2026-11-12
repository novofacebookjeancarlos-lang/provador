import { cookies } from 'next/headers'
import { backend, uuid } from '../../../lib/server'
import { json, error } from './response'

const cookieName = 'provador-loja'
const payload = body => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), method: 'POST' })

export async function owner() {
  const token = (await cookies()).get(cookieName)?.value
  if (!token) return null
  const response = await backend('/auth/v1/user', { token })
  if (!response.ok) return null
  const user = await response.json()
  return user.email_confirmed_at && uuid.test(user.id) ? user.id : null
}

export async function handleSession(action, form) {
  const jar = await cookies()
  if (action === 'logout') {
    jar.delete(cookieName)
    return json({ ok: true })
  }
  if (action === 'login' || action === 'signup') {
    const email = String(form.get('email') || '').trim()
    const password = String(form.get('password') || '')
    if (!email.includes('@') || email.length > 254 || password.length < 8 || password.length > 128) return error('Use um e-mail válido e uma senha de 8 a 128 caracteres.')
    const path = action === 'signup' ? '/auth/v1/signup' : '/auth/v1/token?grant_type=password'
    const response = await backend(path, payload({ email, password }))
    if (!response.ok) return error(action === 'signup' ? 'Não foi possível cadastrar. Confira os dados ou tente mais tarde.' : 'Confira a senha e se o e-mail foi confirmado.', response.status === 429 ? 429 : 400)
    const data = await response.json()
    if (!data.access_token) return json({ message: 'Confirme seu e-mail e depois entre no painel.' })
    jar.set(cookieName, data.access_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: Math.min(data.expires_in || 3600, 3600) })
    return json({ ok: true })
  }

}
