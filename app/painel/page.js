'use client'
import { useEffect, useState } from 'react'

export default function Dashboard() {
  const [data, setData] = useState(undefined)
  const [billing, setBilling] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState('login')

  async function refresh() {
    try {
      const response = await fetch('/api/loja')
      if (response.status === 401) { setBilling(null); return setData(false) }
      if (!response.ok) throw new Error('Painel indisponível.')
      const payload = await response.json()
      setData(payload.dashboard)
      setBilling(payload.billing)
    } catch (error) {
      setBilling(null)
      setData(false)
      setMessage(error.message)
    }
  }

  useEffect(() => { refresh() }, [])

  async function act(event, action) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const element = event.currentTarget
    const form = new FormData(element, event.nativeEvent.submitter || undefined)
    form.set('action', action)
    try {
      const response = await fetch('/api/loja', { method: 'POST', body: form })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      if (result.message) setMessage(result.message)
      if (action === 'piece') element.reset()
      await refresh()
    } catch (error) {
      setMessage(error.message || 'Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  async function copy(path) {
    try {
      await navigator.clipboard.writeText(location.origin + path)
      setMessage('Link copiado.')
    } catch {
      setMessage('Abra o link da peça e copie o endereço.')
    }
  }

  return <main className="dashboard">
    <nav><a href="/">Provador</a><span>Painel do lojista</span></nav>
    <h1>{data?.store?.name || 'Sua loja'}</h1>
    {message && <p className="notice" role="status">{message}</p>}
    {data === undefined && <p>Carregando…</p>}
    {data === false && <form onSubmit={event => act(event, mode)}>
      <h2>{mode === 'login' ? 'Entrar' : 'Criar conta'}</h2>
      <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
      <label>Senha<input name="password" type="password" minLength={8} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /></label>
      <button disabled={busy}>{mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
      <button type="button" className="secondary" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage('') }}>
        {mode === 'login' ? 'Criar conta' : 'Já tenho conta'}
      </button>
    </form>}
    {data === null && <form onSubmit={event => act(event, 'store')}>
      <h2>Cadastrar loja</h2><label>Nome da loja<input name="name" maxLength={80} required /></label>
      <button disabled={busy}>Salvar loja</button>
    </form>}
    {data && <>
      <div className="metrics">
        <section><strong>{data.store.generation_budget}</strong><span>Créditos disponíveis</span></section>
        <section><strong>{data.completed}</strong><span>Provas concluídas</span></section>
        <section><strong>{data.reserved}</strong><span>Provas pendentes</span></section>
      </div>
      <p><a href={"/instalar?loja=" + data.store.id}>Instalar botão na vitrine</a></p>
      <form onSubmit={event => act(event, 'recharge')}>
        <h2>Solicitar créditos</h2>
        <p>O saldo entra depois que o operador confirmar o pagamento.</p>
        <label>Pacote<select name="credits"><option value="30">30 provas · R$ 49</option><option value="100">100 provas · R$ 129</option></select></label>
        <button disabled={busy}>Solicitar recarga</button>
      </form>
      <p>Código da loja <code>{data.store.id}</code></p>
      <form onSubmit={event => act(event, 'piece')}>
        <h2>Adicionar peça</h2>
        <label>Nome da peça ou cor<input name="name" maxLength={120} required /></label>
        <label>Foto da peça<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required /></label>
        <label>Link de compra (opcional)<input name="product" type="url" placeholder="https://…" /></label>
        <button disabled={busy}>Salvar peça</button>
      </form>
      <section>
        <h2>Peças cadastradas</h2>
        {!data.pieces.length && <p>Cadastre a primeira peça para gerar o link.</p>}
        {data.pieces.map(piece => {
          const path = '/?peca=' + piece.id
          return <article className="piece-row" key={piece.id}>
            <div><strong>{piece.name}</strong><small>{piece.enabled ? 'Ativa' : 'Pausada'}</small></div>
            {piece.enabled && <><a href={path}>Abrir provador</a><button type="button" className="secondary" onClick={() => copy(path)}>Copiar link</button></>}
            <form className="inline" onSubmit={event => act(event, 'toggle')}>
              <input type="hidden" name="piece" value={piece.id} /><input type="hidden" name="enabled" value={String(!piece.enabled)} />
              <button disabled={busy}>{piece.enabled ? 'Pausar' : 'Ativar'}</button>
            </form>
            <form className="variant-form" onSubmit={event => act(event, 'variant')}>
              <input type="hidden" name="piece" value={piece.id} />
              <label>ID da variante na vitrine
                <input name="variant" key={data.variants?.[piece.id] || 'empty'} defaultValue={data.variants?.[piece.id] || ''} maxLength={80} />
              </label>
              <button className="secondary" disabled={busy}>Salvar vínculo</button>
            </form>
          </article>
        })}
      </section>
    </>}
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
    {data !== false && data !== undefined && <form className="inline" onSubmit={event => act(event, 'logout')}><button className="secondary" disabled={busy}>Sair</button></form>}
  </main>
}
