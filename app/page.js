'use client'
import { useEffect, useState } from 'react'

export default function Page() {
  const [piece, setPiece] = useState('')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => setPiece(new URLSearchParams(location.search).get('peca') ?? ''), [])
  useEffect(() => () => { if (result) URL.revokeObjectURL(result) }, [result])

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    const form = new FormData(event.currentTarget)
    if (form.get('photo').size + (form.get('garment')?.size ?? 0) > 4_000_000) {
      setError('As fotos juntas devem ter até 4 MB.')
      return
    }
    form.set('piece', piece)
    form.set('requestId', crypto.randomUUID())
    setBusy(true)
    setResult('')
    setError('')
    try {
      const response = await fetch('/api/prova', { method: 'POST', body: form })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Não foi possível gerar a prova.')
      }
      setResult(URL.createObjectURL(await response.blob()))
    } catch (failure) {
      setError(failure.message)
    } finally {
      setBusy(false)
    }
  }

  return <main>
    <header><p>Provador virtual</p><h1>Veja como fica em você</h1></header>
    <form onSubmit={submit}>
      <label>Minha foto <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required /></label>
      {!piece && <label>Foto da roupa <input type="file" name="garment" accept="image/jpeg,image/png,image/webp" required /></label>}
      <label className="consent"><input type="checkbox" name="consent" value="yes" required /> Autorizo o envio da foto à OpenAI para gerar esta simulação.</label>
      <button disabled={busy}>{busy ? 'Gerando sua prova…' : 'Experimentar em mim'}</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {result && <section><h2>Sua prova</h2><img src={result} alt="Simulação de você com a peça" /><a href={result} download="minha-prova.jpg">Baixar imagem</a><button onClick={() => setResult('')}>Limpar resultado</button></section>}
  </main>
}
