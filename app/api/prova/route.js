import sharp from 'sharp'

export const runtime = 'nodejs'
export const maxDuration = 180

function json(error, status) {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
}

async function rpc(name, body) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const response = await fetch(process.env.SUPABASE_URL + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error('Database request failed')
  return response.json()
}

function normalize(bytes) {
  return sharp(bytes, { limitInputPixels: 30_000_000 }).rotate()
    .resize(1024, 1536, { fit: 'inside', withoutEnlargement: true }).jpeg().toBuffer()
}

export async function POST(request) {
  if (!process.env.OPENAI_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_URL) {
    return json('Provador ainda não configurado.', 503)
  }
  const form = await request.formData().catch(() => null)
  const photo = form?.get('photo')
  const piece = form?.get('piece')
  const id = form?.get('requestId')
  const garmentPhoto = form?.get('garment')
  const demo = piece === ''
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
  if (!(photo instanceof File) || (!demo && !uuid.test(piece)) || (demo && !(garmentPhoto instanceof File)) || !uuid.test(id) || form.get('consent') !== 'yes') {
    return json('Dados da prova inválidos.', 400)
  }
  if (!photo.size || (demo && !garmentPhoto.size) || photo.size + (demo ? garmentPhoto.size : 0) > 4_000_000) return json('As fotos juntas devem ter até 4 MB.', 413)

  let person
  let clothing
  try {
    person = await normalize(Buffer.from(await photo.arrayBuffer()))
    if (demo) clothing = await normalize(Buffer.from(await garmentPhoto.arrayBuffer()))
  }
  catch { return json('Não foi possível abrir essa foto.', 422) }

  try {
    if (demo) {
      if (!(await rpc('reserve_demo_tryon', { request_id: id }))) {
        return json('O limite de provas de teste foi atingido.', 429)
      }
    } else {
      const garment = await rpc('reserve_pilot_tryon', { piece_id: piece, request_id: id })
      if (!garment) return json('Peça indisponível ou limite de provas atingido.', 409)
      const pieceUrl = new URL(garment)
      if (pieceUrl.protocol !== 'https:' || pieceUrl.hostname !== process.env.GARMENT_ASSET_HOST) {
        return json('Imagem da peça indisponível.', 503)
      }
      const asset = await fetch(pieceUrl, { redirect: 'error', signal: AbortSignal.timeout(10_000) })
      if (!asset.ok) return json('Imagem da peça indisponível.', 503)
      clothing = await normalize(Buffer.from(await asset.arrayBuffer()))
    }
    const images = new FormData()
    images.append('model', process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2')
    images.append('image[]', new Blob([person], { type: 'image/jpeg' }), 'pessoa.jpg')
    images.append('image[]', new Blob([clothing], { type: 'image/jpeg' }), 'peca.jpg')
    images.append('prompt', 'Use a primeira foto como base. Troque somente a roupa pela peça exata da segunda foto. Preserve rosto, pose, fundo, corte, cor, estampas e logos. Gere uma simulação fotográfica realista.')
    images.append('size', '1024x1536')
    images.append('quality', demo ? 'low' : 'medium')
    const generation = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST', headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY },
      body: images, signal: AbortSignal.timeout(150_000),
    })
    if (!generation.ok) return json('Geração indisponível. Tente mais tarde.', 502)
    const data = await generation.json()
    if (typeof data.data?.[0]?.b64_json !== 'string') return json('A geração não retornou uma imagem.', 502)
    const image = await normalize(Buffer.from(data.data[0].b64_json, 'base64'))
    return new Response(image, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store' } })
  } catch {
    return json('Não foi possível finalizar a prova.', 503)
  }
}
