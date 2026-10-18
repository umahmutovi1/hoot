import { cn } from '@/lib/utils'

// Owl mascot, see docs/design/MASCOT.md. Images live in public/mascot/ (160 px + @2x).
// At most one owl per screen; never in lists or the tab bar.
export type MascotPose =
  | 'reading'
  | 'sleeping'
  | 'timer'
  | 'celebrating'
  | 'reading-head'
  | 'sleeping-head'
  | 'celebrating-head'
  | 'timer-head'

type Props = {
  pose: MascotPose
  size: number
  /** Leave empty when decorative; describe it only on the login screen and empty states. */
  alt?: string
  className?: string
}

export function Mascot({ pose, size, alt = '', className }: Props) {
  return (
    <img
      src={`/mascot/${pose}.webp`}
      srcSet={`/mascot/${pose}@2x.webp 2x`}
      width={size}
      height={size}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      draggable={false}
      className={cn('shrink-0 object-contain select-none', className)}
    />
  )
}
