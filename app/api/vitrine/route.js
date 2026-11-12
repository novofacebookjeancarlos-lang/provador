import { rpc, uuid } from '../../../lib/server'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
}

export async function GET(request) {
  const query = new URL(request.url).searchParams
  const store = query.get('loja')
  const variant = query.get('variante')
  if (!uuid.test(store) || !/^[\w-]{1,80}$/.test(variant || '')) {
    return Response.json({ error: 'Loja ou variante inválida.' }, { status: 400, headers })
  }
  try {
    const id = await rpc('pilot_variant', { p_store: store, p_variant: variant })
    if (!id) return Response.json({ error: 'Variante indisponível.' }, { status: 404, headers })
    return Response.json({ path: '/testar?peca=' + id }, { headers })
  } catch {
    return Response.json({ error: 'Provador temporariamente indisponível.' }, { status: 503, headers })
  }
}
