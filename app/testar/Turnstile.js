'use client'
import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'

export default function Turnstile({ onToken, reset }) {
  const node = useRef(null)
  const widget = useRef(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!ready || !siteKey || !node.current) return
    widget.current = window.turnstile.render(node.current, {
      sitekey: siteKey, action: 'provador', callback: onToken,
      'expired-callback': () => onToken(''),
      'error-callback': () => { onToken(''); setFailed(true) },
    })
    return () => {
      window.turnstile.remove(widget.current)
      widget.current = null
    }
  }, [ready, siteKey, onToken])

  useEffect(() => {
    if (widget.current !== null && reset > 0) window.turnstile.reset(widget.current)
  }, [reset])

  if (!siteKey) return <p>Verificação indisponível neste ambiente.</p>
  return <>
    <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
      onReady={() => setReady(true)} onError={() => setFailed(true)} />
    <div ref={node} />
    {failed && <p role="status">A verificação não carregou. Recarregue a página para tentar novamente.</p>}
  </>
}
