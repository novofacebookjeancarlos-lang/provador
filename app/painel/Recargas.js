export default function Recargas({ billing, busy, act }) {
  return <>
    {!!billing?.requests?.length && <section>
      <h2>{billing.operator ? 'Pedidos de recarga' : 'Histórico de recargas'}</h2>
      {billing.requests.map(request => <article className="piece-row" key={request.id}>
        <div><strong>{billing.operator && request.store + ' · '}{request.credits} provas</strong>
          <small>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(request.amount_cents / 100)} · {
            { pending: 'Aguardando confirmação', confirmed: 'Confirmado', cancelled: 'Cancelado' }[request.status]
          }</small></div>
        {billing.operator && request.status === 'pending' && <form className="variant-form" onSubmit={event => act(event, 'review-recharge')}>
          <input type="hidden" name="request" value={request.id} />
          <label>Referência do pagamento<input name="reference" maxLength={120} /></label>
          <button name="decision" value="confirm" disabled={busy}>Confirmar pagamento</button>
          <button name="decision" value="cancel" type="submit" className="secondary" disabled={busy}>Cancelar pedido</button>
        </form>}
      </article>)}
    </section>}
  </>
}
