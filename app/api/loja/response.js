export const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } })
export const error = (message, status = 400) => json({ error: message }, status)
