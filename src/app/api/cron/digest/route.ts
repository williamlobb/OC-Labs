import { NextRequest, NextResponse } from 'next/server'
import { sendWeeklyDigest } from '@/lib/email/digest'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await sendWeeklyDigest()
    return NextResponse.json(result)
  } catch (err) {
    console.error('Digest cron failed:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
