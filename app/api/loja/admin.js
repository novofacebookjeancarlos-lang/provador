import { rpc, uuid } from '../../../lib/server'
import { json, error } from './response'

export async function admin(action, form, id) {
  if (action === 'admin-credit') {
    const store = form.get('store')
    const amount = Number(form.get('amount'))
    const reference = String(form.get('reference') || '').trim()
    if (!uuid.test(store) || !Number.isInteger(amount) || amount < 1 || amount > 10000 ||
        reference.length < 4 || reference.length > 120) return error('Confira a quantidade e a referência.')
    const credited = await rpc('pilot_admin_credit', {
      p_actor: id, p_store: store, p_amount: amount, p_reference: reference,
    })
    return credited ? json({ message: 'Créditos liberados.' }) : error('Referência já usada, loja indisponível ou acesso restrito.', 409)
  }
  if (action === 'admin-store') {
    const store = form.get('store')
    const limit = Number(form.get('limit'))
    if (!uuid.test(store) || !Number.isInteger(limit) || limit < 1 || limit > 1000) return error('Loja ou limite inválido.')
    const saved = await rpc('pilot_admin_store', { p_actor: id, p_store: store, p_limit: limit, p_suspended: form.get('suspended') === 'on' })
    return saved ? json({ message: 'Loja atualizada.' }) : error('Acesso administrativo restrito ou loja indisponível.', 403)
  }
}
