import type { NextRequest } from 'next/server'

type HttpError = Error & {
  status?: number
  headers?: Record<string, string>
}

/**
 * Safely read and parse JSON body with an explicit size cap.
 * Next.js App Router doesn't enforce the legacy bodyParser.sizeLimit config,
 * so we guard against oversized payloads here.
 */
export async function readJsonWithLimit(
  request: NextRequest,
  maxBytes: number = 1_000_000 // 1 MB
): Promise<unknown> {
  const contentLength = request.headers.get('content-length')
  if (contentLength && Number(contentLength) > maxBytes) {
    const error: HttpError = new Error(
      `Request body too large. Limit is ${Math.floor(maxBytes / 1024)} KB.`
    )
    error.status = 413
    error.headers = {
      'Content-Length': contentLength,
    }
    throw error
  }

  const reader = request.body?.getReader()
  if (!reader) {
    return {}
  }

  const chunks: Uint8Array[] = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      received += value.byteLength
      if (received > maxBytes) {
        const error: HttpError = new Error(
          `Request body too large. Limit is ${Math.floor(maxBytes / 1024)} KB.`
        )
        error.status = 413
        throw error
      }
      chunks.push(value)
    }
  }

  const combined = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }

  const decoder = new TextDecoder()
  const jsonString = decoder.decode(combined)
  try {
    return JSON.parse(jsonString || '{}')
  } catch {
    const error: HttpError = new Error('Invalid JSON payload')
    error.status = 400
    throw error
  }
}
