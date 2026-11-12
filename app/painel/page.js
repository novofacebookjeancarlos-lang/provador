'use client'
import { useEffect, useState } from 'react'

export default function Dashboard() {
  const [data, setData] = useState(undefined)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState('login')

  async function refresh() {
    try {
      const response = await fetch('/api/loja')
      if (response.status === 401) return setData(false)
      if (!response.ok) throw new Error('Painel indisponível.')
      setData((await response.json()).dashboard)
    } catch (error) {
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
    const form = new FormData(element)
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
    <h1>{data?.store.name || 'Sua loja'}</h1>
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
      <p>Recargas do piloto são registradas manualmente. Código da loja <code>{data.store.id}</code></p>
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
          </article>
        })}
      </section>
    </>}
    {data !== false && data !== undefined && <form className="inline" onSubmit={event => act(event, 'logout')}><button className="secondary" disabled={busy}>Sair</button></form>}
  </main>
}
