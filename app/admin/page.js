'use client'
import { useEffect, useState } from 'react'

export default function Admin() {
  const [overview, setOverview] = useState(null)
  const [notice, setNotice] = useState('Carregando…')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    try {
      const response = await fetch('/api/loja?admin=1')
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error)
      setOverview(payload.overview)
      setNotice('')
    } catch (error) {
      setOverview(null)
      setNotice(error.message || 'Administração indisponível.')
    }
  }
  useEffect(() => { refresh() }, [])

  async function save(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    form.set('action', 'admin-store')
    setBusy(true)
    try {
      const response = await fetch('/api/loja', { method: 'POST', body: form })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error)
      await refresh()
      setNotice(payload.message)
    } catch (error) {
      setNotice(error.message || 'Não foi possível salvar.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="dashboard">
    <nav><a href="/painel">Painel e recargas</a><a href="/">Início</a></nav>
    <h1>Administração</h1>
    {notice && <p className="notice" role="status">{notice}</p>}
    {overview && <>
      <div className="metrics">
        <section><strong>{overview.store_count}</strong><span>Lojas</span></section>
        <section><strong>{overview.proof_count}</strong><span>Provas concluídas</span></section>
        <section><strong>{overview.pending_count}</strong><a href="/painel">Recargas pendentes</a></section>
      </div>
      <h2 className="section-title">Lojas</h2>
      {!overview.stores.length && <p>Nenhuma loja cadastrada.</p>}
      {overview.stores.map(store => <form key={store.id} onSubmit={save}>
        <h3>{store.name}</h3><p>{store.generation_budget} créditos disponíveis</p>
        <input type="hidden" name="store" value={store.id} />
        <label>Limite diário<input type="number" name="limit" min={1} max={1000} defaultValue={store.daily_limit} required /></label>
        <label className="consent"><input type="checkbox" name="suspended" defaultChecked={store.suspended} /> Suspender provador da loja</label>
        <button disabled={busy}>Salvar loja</button>
      </form>)}
    </>}
  </main>
}
