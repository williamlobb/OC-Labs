import { avatarColor } from '@/lib/utils/avatar'
import { cn } from '@/lib/utils/cn'

interface AvatarProps {
  userId: string
  name: string
  photoUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

function getInitials(name: string): string {
  if (!name.trim()) return '?'
  const parts = name.trim().split(/\s+/)
  return parts
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

const SIZE_CLASSES = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
}

export function Avatar({ userId, name, photoUrl, size = 'md', className }: AvatarProps) {
  const color = avatarColor(userId)

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        className={cn('rounded-full object-cover', SIZE_CLASSES[size], className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full font-medium',
        SIZE_CLASSES[size],
        className
      )}
      style={{ backgroundColor: color.bg, color: color.fg }}
    >
      {getInitials(name)}
    </div>
  )
}
