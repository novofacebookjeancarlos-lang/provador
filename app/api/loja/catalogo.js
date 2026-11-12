import { randomUUID } from 'node:crypto'
import { backend, imagePath, normalize, rpc, uuid } from '../../../lib/server'
import { json, error } from './response'

export async function catalogo(action, form, id) {
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
}
