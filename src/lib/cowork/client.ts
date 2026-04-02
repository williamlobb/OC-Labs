// src/lib/cowork/client.ts
// CoWork is the source of truth for name, title, brand, and profile_photo_url.
// These fields are read-only in OC Labs.

export interface CoWorkProfile {
  name: string
  title: string
  brand: string
  profile_photo_url: string | null
}

export async function fetchCoWorkProfile(email: string): Promise<CoWorkProfile | null> {
  const apiUrl = process.env.COWORK_API_URL
  const apiKey = process.env.COWORK_API_KEY

  if (!apiUrl || !apiKey) {
    console.warn('CoWork API credentials not configured')
    return null
  }

  try {
    const res = await fetch(`${apiUrl}/profile?email=${encodeURIComponent(email)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 900 }, // 15-min cache per handover spec
    })

    if (!res.ok) return null

    const data = await res.json()
    return {
      name: data.name ?? '',
      title: data.title ?? '',
      brand: data.brand ?? '',
      profile_photo_url: data.profile_photo_url ?? null,
    }
  } catch {
    return null
  }
}
