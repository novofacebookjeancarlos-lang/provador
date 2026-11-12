import { rpc } from '../../../lib/server'
import { json, error } from './response'
import { handleSession, owner } from './session'
import { admin } from './admin'
import { recargas } from './recargas'
import { catalogo } from './catalogo'

export const runtime = 'nodejs'

export async function GET(request) {
  try {
    const id = await owner()
    if (!id) return error('Entre na sua conta.', 401)
    if (new URL(request.url).searchParams.has('admin')) {
      const overview = await rpc('pilot_admin_overview', { p_actor: id })
      return overview ? json({ overview }) : error('Acesso administrativo restrito.', 403)
    }
    const [dashboard, variants, billing] = await Promise.all([
      rpc('pilot_dashboard', { p_owner: id }), rpc('pilot_variants', { p_owner: id }), rpc('pilot_recharges', { p_actor: id }),
    ])
    if (dashboard) dashboard.variants = variants
    return json({ dashboard, billing })
  } catch {
    return error('Painel indisponível. Tente novamente.', 503)
  }
}

export async function POST(request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return error('Origem inválida.', 403)
  try {
    const form = await request.formData()
    const action = form.get('action')
    if (['login', 'signup', 'logout'].includes(action)) return await handleSession(action, form)
    const id = await owner()
    if (!id) return error('Entre na sua conta.', 401)
    if (action === 'admin-credit' || action === 'admin-store') return await admin(action, form, id)
    if (action === 'recharge' || action === 'review-recharge') return await recargas(action, form, id)
    return await catalogo(action, form, id)
  } catch {
    return error('Não foi possível concluir a ação.', 503)
  }
}
