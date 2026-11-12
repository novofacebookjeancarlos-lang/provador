import { cookies } from 'next/headers'
import { randomUUID } from 'node:crypto'
import { backend, imagePath, normalize, rpc, uuid } from '../../../lib/server'

export const runtime = 'nodejs'
const cookieName = 'provador-loja'
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } })
const error = (message, status = 400) => json({ error: message }, status)
const payload = body => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), method: 'POST' })

async function owner() {
  const token = (await cookies()).get(cookieName)?.value
  if (!token) return null
  const response = await backend('/auth/v1/user', { token })
  if (!response.ok) return null
  const user = await response.json()
  return user.email_confirmed_at && uuid.test(user.id) ? user.id : null
}

export async function GET() {
  try {
    const id = await owner()
    if (!id) return error('Entre na sua conta.', 401)
    const [dashboard, variants] = await Promise.all([
      rpc('pilot_dashboard', { p_owner: id }), rpc('pilot_variants', { p_owner: id }),
    ])
    if (dashboard) dashboard.variants = variants
    return json({ dashboard })
  } catch {
    return error('Painel indisponível. Tente novamente.', 503)
  }
}

export async function POST(request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return error('Origem inválida.', 403)
  try {
    const form = await request.formData()
    const action = form.get('action')
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

    const id = await owner()
    if (!id) return error('Entre na sua conta.', 401)
    const name = String(form.get('name') || '').trim()
    if (action === 'store') {
      if (!name || name.length > 80) return error('Informe o nome da loja.')
      return json({ dashboard: await rpc('pilot_dashboard', { p_owner: id, p_name: name }) })
    }
    if (action === 'toggle') {
      const piece = form.get('piece')
      if (!uuid.test(piece)) return error('Peça inválida.')
      const changed = await rpc('pilot_toggle_piece', { p_owner: id, p_piece: piece, p_enabled: form.get('enabled') === 'true' })
      return changed ? json({ ok: true }) : error('Peça indisponível.', 404)
    }
    if (action === 'variant') {
      const piece = form.get('piece')
      const variant = String(form.get('variant') || '').trim()
      if (!uuid.test(piece) || (variant && !/^[\w-]{1,80}$/.test(variant))) return error('ID de variante inválido.')
      const variants = await rpc('pilot_variants', { p_owner: id })
      if (variant && Object.entries(variants).some(([key, value]) => key !== piece && value === variant)) {
        return error('Essa variante já está vinculada a outra peça.', 409)
      }
      const saved = await rpc('pilot_set_variant', { p_owner: id, p_piece: piece, p_variant: variant || null })
      return saved ? json({ ok: true }) : error('Peça indisponível.', 404)
    }
    if (action !== 'piece') return error('Ação inválida.')
    const photo = form.get('photo')
    if (!name || name.length > 120 || !(photo instanceof File) || !photo.size || photo.size > 4_000_000) {
      return error('Informe o nome e uma imagem de até 4 MB.')
    }
    const product = String(form.get('product') || '').trim()
    if (product) {
      const url = URL.parse(product)
      if (!url || url.protocol !== 'https:' || url.username || url.password || product.length > 2048) return error('Use um link HTTPS válido para a página da peça.')
    }
    const dashboard = await rpc('pilot_dashboard', { p_owner: id })
    if (!dashboard) return error('Cadastre a loja primeiro.')
    const bytes = await normalize(Buffer.from(await photo.arrayBuffer())).catch(() => null)
    if (!bytes) return error('Não foi possível abrir a imagem.')
    const piece = randomUUID()
    const key = dashboard.store.id + '/' + piece + '.jpg'
    const uploaded = await backend(imagePath(key), { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: bytes })
    if (!uploaded.ok) return error('Não foi possível salvar a imagem.', 503)
    const saved = await rpc('pilot_save_piece', { p_owner: id, p_piece: piece, p_name: name, p_key: key, p_url: product || null })
    if (!saved) {
      await backend(imagePath(key), { method: 'DELETE' })
      return error('Não foi possível cadastrar a peça.', 503)
    }
    return json({ ok: true }, 201)
  } catch {
    return error('Não foi possível concluir a ação.', 503)
  }
}
