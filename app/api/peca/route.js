import { backend, imagePath, rpc, uuid } from '../../../lib/server'

export async function GET(request) {
  const query = new URL(request.url).searchParams
  const id = query.get('id')
  const headers = { 'Cache-Control': 'no-store' }
  if (!uuid.test(id)) return Response.json({ error: 'Peça inválida.' }, { status: 400, headers })
  try {
    const piece = await rpc('pilot_public_piece', { p_piece: id })
    if (!piece) return Response.json({ error: 'Peça indisponível.' }, { status: 404, headers })
    if (!query.has('imagem')) return Response.json({
      name: piece.name, store: piece.store, product: piece.product_url,
      image: piece.image_key ? '/api/peca?id=' + id + '&imagem=1' : null,
    }, { headers })
    if (!piece.image_key) return new Response(null, { status: 404, headers })
    const response = await backend(imagePath(piece.image_key))
    if (!response.ok) return new Response(null, { status: 404, headers })
    return new Response(response.body, { headers: { ...headers, 'Content-Type': 'image/jpeg', 'X-Content-Type-Options': 'nosniff' } })
  } catch {
    return Response.json({ error: 'Peça temporariamente indisponível.' }, { status: 503, headers })
  }
}
