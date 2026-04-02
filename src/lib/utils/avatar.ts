// src/lib/utils/avatar.ts
import { type AvatarColor } from '@/types'

const AVATAR_COLORS: AvatarColor[] = [
  { bg: '#EEEDFE', fg: '#3C3489' },
  { bg: '#E1F5EE', fg: '#085041' },
  { bg: '#E6F1FB', fg: '#0C447C' },
  { bg: '#FAEEDA', fg: '#633806' },
  { bg: '#FAECE7', fg: '#712B13' },
  { bg: '#FBEAF0', fg: '#72243E' },
]

export function avatarColor(userId: string): AvatarColor {
  const index = userId.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[index]
}
