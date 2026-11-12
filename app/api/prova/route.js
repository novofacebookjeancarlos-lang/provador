import { backend, imagePath, normalize, rpc, uuid } from '../../../lib/server.js'
import { checkRate, generationLimits, sendBudgetAlert, verifyTurnstile } from '../../../lib/generation-guard.js'

export const runtime = 'nodejs'
export const maxDuration = 180

function json(error, status) {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
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
  if (!(photo instanceof File) || (!demo && !uuid.test(piece)) || (demo && !(garmentPhoto instanceof File)) || !uuid.test(id) || form.get('consent') !== 'yes') {
    return json('Dados da prova inválidos.', 400)
  }
  if (!photo.size || (demo && !garmentPhoto.size) || photo.size + (demo ? garmentPhoto.size : 0) > 4_000_000) return json('As fotos juntas devem ter até 4 MB.', 413)

  let limits
  try {
    limits = generationLimits()
    if (!(await checkRate(request, limits.rate))) return json('Muitas tentativas. Aguarde um minuto.', 429)
    if (!(await verifyTurnstile(form.get('turnstileToken'), new URL(request.url).hostname))) {
      return json('Não foi possível validar a verificação. Tente novamente.', 403)
    }
  } catch {
    return json('Verificação temporariamente indisponível.', 503)
  }

  let person
  let clothing
  try {
    person = await normalize(Buffer.from(await photo.arrayBuffer()))
    if (demo) clothing = await normalize(Buffer.from(await garmentPhoto.arrayBuffer()))
  }
  catch { return json('Não foi possível abrir essa foto.', 422) }

  let reserved = false
  let started = null
  let usage = null
  let errorCode = null
  async function settle(state) {
    if (reserved) await rpc('pilot_settle', { p_request: id, p_state: state })
  }

  try {
    if (!demo) {
      const item = await rpc('pilot_public_piece', { p_piece: piece })
      if (!item) return json('Peça indisponível.', 404)
      let asset
      if (item.image_key) {
        asset = await backend(imagePath(item.image_key))
      } else {
        const url = URL.parse(item.garment_url)
        if (!url || url.protocol !== 'https:' || url.hostname !== process.env.GARMENT_ASSET_HOST) {
          return json('Imagem da peça indisponível.', 503)
        }
        asset = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10_000) })
      }
      if (!asset.ok) return json('Imagem da peça indisponível.', 503)
      clothing = await normalize(Buffer.from(await asset.arrayBuffer()))
    }
    const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2'
    const quality = 'low'
    const size = '1024x1536'
    const images = new FormData()
    images.append('model', model)
    images.append('image[]', new Blob([person], { type: 'image/jpeg' }), 'pessoa.jpg')
    images.append('image[]', new Blob([clothing], { type: 'image/jpeg' }), 'peca.jpg')
    images.append('prompt', 'Use a primeira foto como base. Troque somente a roupa pela peça exata da segunda foto. Preserve rosto, pose, fundo, corte, cor, estampas e logos. Gere uma simulação fotográfica realista.')
    images.append('size', size)
    images.append('quality', quality)
    const reservation = await rpc('generation_reserve', {
      p_request: id, p_piece: demo ? null : piece, p_daily: limits.daily, p_unit: limits.unit,
      p_model: model, p_quality: quality, p_size: size,
    })
    switch (reservation?.status) {
      case 'allowed': break
      case 'budget':
        await sendBudgetAlert(reservation, limits.daily)
        return json('O provador atingiu o limite de hoje. Tente novamente amanhã.', 503)
      case 'demo': return json('O limite de provas de teste foi atingido.', 429)
      case 'store': return json('Peça indisponível ou loja sem créditos.', 409)
      case 'duplicate': return json('Esta prova já foi solicitada.', 409)
      default: return json('Não foi possível reservar a prova.', 503)
    }
    reserved = !demo
    started = Date.now()
    await sendBudgetAlert(reservation, limits.daily)
    const generation = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST', headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY },
      body: images, signal: AbortSignal.timeout(150_000),
    })
    if (!generation.ok) {
      errorCode = 'openai_http_' + generation.status
      await settle(generation.status >= 500 ? 'unknown' : 'failed')
      return json('Geração indisponível. Tente mais tarde.', 502)
    }
    const data = await generation.json()
    usage = data.usage ?? null
    if (typeof data.data?.[0]?.b64_json !== 'string') throw new Error('Missing generated image')
    const image = await normalize(Buffer.from(data.data[0].b64_json, 'base64'))
    await settle('completed')
    return new Response(image, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    errorCode ||= error?.name === 'TimeoutError' ? 'timeout' : 'generation_failed'
    await settle(started === null ? 'failed' : 'unknown').catch(() => {})
    return json('Não foi possível finalizar a prova.', 503)
  } finally {
    if (started !== null) {
      await rpc('generation_finish', { p_request: id, p_duration: Date.now() - started, p_error: errorCode, p_usage: usage })
        .catch(() => console.error(JSON.stringify({ event: 'generation_telemetry_write_failed', requestId: id })))
    }
  }
}
