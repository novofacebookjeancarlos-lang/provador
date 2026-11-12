'use client'
import { useEffect, useState } from 'react'

export default function Install() {
  const [store, setStore] = useState('')
  const [origin, setOrigin] = useState('')
  const [platform, setPlatform] = useState('shopify')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const value = new URLSearchParams(location.search).get('loja') || ''
    if (/^[a-f0-9-]{36}$/i.test(value)) setStore(value)
    setOrigin(location.origin)
  }, [])

  const snippet = (platform === 'shopify'
    ? '<div id="provador-vitrine"></div>\n'
    : '<div id="provador-vitrine" data-variante="ID_DA_VARIANTE"></div>\n') +
    '<script src="' + origin + '/provador.js" data-loja="' + store + '"' +
    (platform === 'shopify' ? ' data-variante="{{ product.selected_or_first_available_variant.id }}"' : '') +
    ' defer></script>'

  return <main>
    <nav><a href="/painel">Painel do lojista</a></nav>
    <h1>Instalar na vitrine</h1>
    <div className="actions">
      <button aria-pressed={platform === 'shopify'} onClick={() => { setPlatform('shopify'); setCopied(false) }}>Shopify</button>
      <button aria-pressed={platform === 'custom'} onClick={() => { setPlatform('custom'); setCopied(false) }}>Loja com código próprio</button>
    </div>
    <section>
      <ol>
        <li>Cadastre a foto de cada variante que vai participar e informe o ID no painel.</li>
        {platform === 'shopify'
          ? <li>Adicione um bloco Liquid personalizado à página de produto.</li>
          : <li>Cole o trecho perto do botão de compra. No seu código, atualize o atributo <code>data-variante</code> do elemento quando a seleção mudar.</li>}
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
