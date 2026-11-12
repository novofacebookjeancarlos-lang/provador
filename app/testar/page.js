'use client'
import { useEffect, useState } from 'react'
import Turnstile from './Turnstile'

export default function Page() {
  const [piece, setPiece] = useState('')
  const [item, setItem] = useState(null)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [camera, setCamera] = useState(false)
  const [token, setToken] = useState('')
  const [challengeReset, setChallengeReset] = useState(0)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('peca') ?? ''
    setPiece(id)
    if (id) fetch('/api/peca?id=' + encodeURIComponent(id))
      .then(async response => {
        if (!response.ok) throw new Error('Peça indisponível.')
        setItem(await response.json())
      })
      .catch(error => setError(error.message))
  }, [])
  useEffect(() => () => { if (result) URL.revokeObjectURL(result) }, [result])

  async function submit(event) {
    event.preventDefault()
    if (busy || !token) return
    const form = new FormData(event.currentTarget)
    if (form.get('photo').size + (form.get('garment')?.size ?? 0) > 4_000_000) {
      setError('As fotos juntas devem ter até 4 MB.')
      return
    }
    form.set('piece', piece)
    form.set('turnstileToken', token)
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
      setToken('')
      setChallengeReset(value => value + 1)
      setBusy(false)
    }
  }

  return <main>
    <nav><span>{item?.store || 'Provador virtual'}</span>{!piece && <a href="/painel">Painel do lojista</a>}</nav>
    <header><h1>Veja como fica em você</h1></header>
    {item && <section className="product"><h2>{item.name}</h2>{item.image && <img src={item.image} alt={item.name} />}</section>}
    {(!piece || item) && <form onSubmit={submit}>
      <div className="photo-options">
        <button type="button" className="secondary" aria-pressed={!camera} onClick={() => setCamera(false)}>Escolher foto</button>
        <button type="button" className="secondary" aria-pressed={camera} onClick={() => setCamera(true)}>Usar câmera</button>
      </div>
      <label>Minha foto <input key={String(camera)} type="file" name="photo" accept={camera ? 'image/*' : 'image/jpeg,image/png,image/webp'} capture={camera ? 'user' : undefined} required /></label>
      {!piece && <label>Foto da roupa <input type="file" name="garment" accept="image/jpeg,image/png,image/webp" required /></label>}
      <label className="consent"><input type="checkbox" name="consent" value="yes" required /> Autorizo o envio da foto à OpenAI para gerar esta simulação.</label>
      <Turnstile onToken={setToken} reset={challengeReset} />
      <button disabled={busy || !token}>{busy ? 'Gerando sua prova…' : 'Experimentar em mim'}</button>
    </form>}
    {error && <p role="alert">{error}</p>}
    {item?.product && <p><a href={item.product}>Voltar para comprar</a></p>}
    {result && <section><h2>Sua prova</h2><p>Simulação visual da peça.</p><img src={result} alt="Simulação de você com a peça" /><a href={result} download="minha-prova.jpg">Baixar imagem</a><button onClick={() => setResult('')}>Limpar resultado</button></section>}
  </main>
}
