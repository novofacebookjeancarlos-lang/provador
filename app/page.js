import { redirect } from 'next/navigation'

export default async function Home({ searchParams }) {
  const query = await searchParams
  if (typeof query.peca === 'string' && query.peca) redirect('/testar?peca=' + encodeURIComponent(query.peca))

  return <main className="landing">
    <nav className="site-nav"><a className="wordmark" href="/">Provador<span>Virtual</span></a><div><a href="#como-funciona">Como funciona</a><a href="#planos">Créditos</a><a href="/painel">Área do lojista</a></div></nav>
    <header className="hero">
      <div><h1>Da vitrine para<br /> <em>o seu espelho.</em></h1>
      <p>Adicione um provador com IA à sua loja. A cliente escolhe a peça, tira uma foto e recebe uma prévia usando a roupa.</p>
      <div className="actions"><a className="cta" href="/testar">Testar com duas fotos</a><a href="/painel">Criar conta de lojista</a></div></div>
      <figure className="hero-preview"><img src="/editorial.webp" alt="Modelo vestindo um colete verde em estúdio" fetchPriority="high" /><figcaption><span>Prévia do provador</span><strong>Colete de linho</strong><a href="/testar">Experimentar em mim <span aria-hidden="true">↗</span></a></figcaption></figure>
    </header>
    <section id="como-funciona" className="how landing-section"><h2>Do clique à prova</h2><div className="steps">
      <article><h3>Escolha a peça</h3><p>O botão abre a variante selecionada na vitrine.</p></article>
      <article><h3>Tire uma foto</h3><p>A cliente usa a câmera ou escolhe uma imagem da galeria.</p></article>
      <article><h3>Veja o resultado</h3><p>A simulação aparece na tela com um link de volta para a peça.</p></article>
    </div></section>
    <section className="landing-section integration"><h2>Instale na sua vitrine</h2><p>Use um bloco Liquid na Shopify ou um script em uma loja própria. O painel permite vincular cada variante à foto correspondente e pausar peças a qualquer momento.</p></section>
    <section id="planos" className="landing-section"><h2>Créditos pré-pagos</h2><p>Solicite recargas no painel. Os créditos entram após a confirmação do pagamento.</p><div className="metrics"><section><strong>R$ 49</strong><span>30 provas</span></section><section><strong>R$ 129</strong><span>100 provas</span></section></div></section>
    <section className="landing-section final-cta"><h2>Experimente com uma peça da sua loja</h2><a className="cta" href="/testar">Abrir o provador</a></section>
    <footer><strong>Provador Virtual</strong><a href="/painel">Área do lojista</a></footer>
  </main>
}
