import sharp from 'sharp'

export function normalize(bytes) {
  return sharp(bytes, { limitInputPixels: 30_000_000 }).rotate()
    .resize(1024, 1536, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 }).toBuffer()
}

export async function backend(path, { token, headers, ...options } = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return fetch(process.env.SUPABASE_URL + path, {
    ...options, cache: 'no-store', signal: AbortSignal.timeout(15_000),
    headers: { apikey: key, Authorization: 'Bearer ' + (token || key), ...headers },
  })
}

export async function rpc(name, body) {
  const response = await backend('/rest/v1/rpc/' + name, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error('Database request failed')
  return response.json()
}

export const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
export const imagePath = key => '/storage/v1/object/provador-produtos/' + key
