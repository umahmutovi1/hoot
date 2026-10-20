import type { SVGProps } from 'react'

// Stroke icons copied from the mockups (24×24, 1.8 px stroke).
type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 22, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const HomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />
  </Icon>
)

export const CalendarIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="5" width="16" height="15" rx="3" />
    <path d="M4 10h16M9 3v4M15 3v4" />
  </Icon>
)

export const BookIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 6c-2-1.5-5-2-8-1.5v14c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-14c-3-.5-6 0-8 1.5z" />
  </Icon>
)

export const ChartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
  </Icon>
)

export const TimerIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}>
    <circle cx="12" cy="13" r="7" />
    <path d="M12 10v3l2 2M10 3h4" />
  </Icon>
)

export const BellIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Icon>
)

export const GearIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" />
  </Icon>
)

export const ChevronLeftIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
)

export const PlusIcon = (p: IconProps) => (
  <Icon strokeWidth={2.2} {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const CloseIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
)

export const PencilIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
  </Icon>
)

export const ChevronDownIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
)

export const FlagIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </Icon>
)

export const ChevronRightIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}>
    <path d="M9 5l7 7-7 7" />
  </Icon>
)

export const CameraIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </Icon>
)

export const SparkleIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
  </Icon>
)

export const WarningIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l10 18H2z" />
    <path d="M12 10v4M12 17h.01" />
  </Icon>
)

export const MoreIcon = ({ size = 20, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    {...props}
  >
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </svg>
)

export const CheckIcon = (p: IconProps) => (
  <Icon strokeWidth={2.2} {...p}>
    <path d="M5 12l5 5 9-10" />
  </Icon>
)

export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4l3 2" />
  </Icon>
)

/** Graduation cap: timetable and lectures. */
export const CapIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 9l9-5 9 5-9 5z" />
    <path d="M7 11v5c3 2 7 2 10 0v-5" />
  </Icon>
)

/** Owl conversation: send (arrow up). */
export const SendIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Icon>
)

export const DocIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M14 3v5h5" />
  </Icon>
)

export const ImageIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="5" width="16" height="14" rx="3" />
    <path d="M4 16l5-5 4 4 2-2 5 5" />
  </Icon>
)

export const TextIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 6h14M5 11h14M5 16h9" />
  </Icon>
)

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" />
  </Icon>
)
