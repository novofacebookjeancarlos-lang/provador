import { rpc, uuid } from '../../../lib/server'
import { json, error } from './response'

export async function recargas(action, form, id) {
  if (action === 'recharge') {
    const credits = Number(form.get('credits'))
    if (![30, 100].includes(credits)) return error('Escolha um pacote.')
    const requestId = await rpc('pilot_request_recharge', { p_owner: id, p_credits: credits })
    return requestId ? json({ message: 'Pedido de recarga registrado.' }, 201) : error('Já existe um pedido pendente ou falta cadastrar sua loja.', 409)
  }
  if (action === 'review-recharge') {
    const requestId = form.get('request')
    const decision = form.get('decision')
    const reference = String(form.get('reference') || '').trim()
    if (!uuid.test(requestId) || !['confirm', 'cancel'].includes(decision)) return error('Pedido inválido.')
    if (decision === 'confirm' && (reference.length < 4 || reference.length > 120)) return error('Informe a referência do pagamento confirmado.')
    const done = await rpc('pilot_review_recharge', {
      p_actor: id, p_request: requestId, p_approve: decision === 'confirm', p_reference: reference || null,
    })
    return done ? json({ message: 'Pedido atualizado.' }) : error('Pedido indisponível, referência já usada ou acesso insuficiente.', 409)
  }
}
