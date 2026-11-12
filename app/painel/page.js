'use client'
import { useEffect, useState } from 'react'
import Catalogo from './Catalogo'
import Recargas from './Recargas'

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
    <nav><a href="/">Provador</a><span>Painel do lojista</span>{billing?.operator && <a href="/admin">Administração</a>}</nav>
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
      <Catalogo data={data} busy={busy} act={act} copy={copy} />
    </>}
      <Recargas billing={billing} busy={busy} act={act} />
    {data !== false && data !== undefined && <form className="inline" onSubmit={event => act(event, 'logout')}><button className="secondary" disabled={busy}>Sair</button></form>}
  </main>
}
