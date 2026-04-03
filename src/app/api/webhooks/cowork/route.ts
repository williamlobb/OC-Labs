import { NextRequest, NextResponse } from 'next/server'
import { handleCoWorkWebhook } from '@/lib/cowork/sync'

export async function POST(req: NextRequest): Promise<NextResponse> {
  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    await handleCoWorkWebhook(payload)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(JSON.stringify({ event: 'cowork_webhook_error', error: message }))
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
