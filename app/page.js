import { redirect } from 'next/navigation'
import './landing.css'

export default async function Home({ searchParams }) {
  const query = await searchParams
  if (typeof query.peca === 'string' && query.peca) redirect('/testar?peca=' + encodeURIComponent(query.peca))

  return <main className="showroom">
    <nav className="showroom-nav" aria-label="Principal">
      <a className="showroom-brand" href="/"><span aria-hidden="true">p.</span> provador</a>
      <a href="/painel">Área do lojista <span aria-hidden="true">↗</span></a>
    </nav>

    <header className="showroom-hero">
      <div className="showroom-copy">
        <h1>Prove a roupa<br /> <em>antes de comprar.</em></h1>
        <p>Instale um provador na sua loja. A cliente escolhe a peça, envia uma foto e vê como ela fica no próprio corpo.</p>
        <a className="showroom-cta" href="/testar">Testar o provador <span aria-hidden="true">↗</span></a>
      </div>

      <div className="showroom-stage">
        <figure className="showroom-preview">
          <div className="preview-title"><strong>Seu provador</strong><span>Prévia</span></div>
          <img src="/editorial.webp" alt="Prévia ilustrativa de uma modelo usando um colete verde de linho" fetchPriority="high" />
          <figcaption><span>Colete de linho</span><a href="/testar">Experimentar em mim <span aria-hidden="true">↗</span></a></figcaption>
        </figure>
      </div>
    </header>

    <section className="showroom-flow" aria-label="Como funciona">
      <article><h2>Escolha a peça</h2><p>Abra o provador na página do produto.</p></article>
      <article><h2>Envie uma foto</h2><p>Use a câmera ou a galeria do celular.</p></article>
      <article><h2>Veja como fica</h2><p>Veja a simulação e volte à loja para comprar.</p></article>
    </section>
  </main>
}
