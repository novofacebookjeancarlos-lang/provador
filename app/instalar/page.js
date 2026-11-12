'use client'
import { useEffect, useState } from 'react'

export default function Install() {
  const [store, setStore] = useState('')
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const value = new URLSearchParams(location.search).get('loja') || ''
    if (/^[a-f0-9-]{36}$/i.test(value)) setStore(value)
    setOrigin(location.origin)
  }, [])

  const snippet = '<div id="provador-vitrine"></div>\n<script src="' + origin +
    '/provador.js" data-loja="' + store +
    '" data-variante="{{ product.selected_or_first_available_variant.id }}" defer></script>'

  return <main>
    <nav><a href="/painel">Painel do lojista</a></nav>
    <h1>Instalar na Shopify</h1>
    <section>
      <ol>
        <li>Cadastre a foto de cada variante que vai participar e informe o ID no painel.</li>
        <li>No editor do tema, abra a página de produto e adicione um bloco Liquid personalizado.</li>
        <li>Cole o trecho abaixo, salve e teste o botão em duas variantes cadastradas.</li>
      </ol>
      {store && origin ? <>
        <textarea readOnly rows={5} aria-label="Código do provador" value={snippet} />
        <button onClick={async () => {
          try { await navigator.clipboard.writeText(snippet); setCopied(true) }
          catch { setCopied(false) }
        }}>{copied ? 'Código copiado' : 'Copiar código'}</button>
      </> : <p>Abra esta página pelo painel para gerar o código da sua loja.</p>}
    </section>
  </main>
}
