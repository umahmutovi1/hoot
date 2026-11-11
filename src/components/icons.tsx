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

export const LinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Icon>
)

export const SkipIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 6l8 6-8 6z" />
    <path d="M18 6v12" />
  </Icon>
)

export const CircleMinusIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 12h7" />
  </Icon>
)

export const ArchiveIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="4.5" width="17" height="4.5" rx="1.5" />
    <path d="M5.5 9v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V9M10 13h4" />
  </Icon>
)

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Icon>
)

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" />
  </Icon>
)

/** The assistant's mark: a filled four-point sparkle with a small one (AI tab, chat). */
export const AiSparkIcon = ({ size = 22, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    {...props}
  >
    <path d="M11 2.5l2.1 6 6.4 2.1-6.4 2.1-2.1 6.3-2.1-6.3-6.4-2.1 6.4-2.1z" />
    <path d="M19.2 15.2l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
  </svg>
)

export const MenuIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
)

export const SignOutIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M16 17l5-5-5-5M21 12H9" />
  </Icon>
)

export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Icon>
)

export const MoonIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </Icon>
)

export const BoltIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" />
  </Icon>
)

// Bottom tab bar (NavVarijante, Sprint 19).
export const TodayTabIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M17 12C17 14.76 14.76 17 12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12Z M12 2V3.5M12 20.5V22M19.07 19.07L18.01 18.01M5.99 5.99L4.93 4.93M22 12H20.5M3.5 12H2M19.07 4.93L18.01 5.99M5.99 18.01L4.93 19.07" />
  </Icon>
)
export const PlanTabIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M16 2V6M8 2V6 M13 4H11C7.23 4 5.34 4 4.17 5.17C3 6.34 3 8.23 3 12V14C3 17.77 3 19.66 4.17 20.83C5.34 22 7.23 22 11 22H13C16.77 22 18.66 22 19.83 20.83C21 19.66 21 17.77 21 14V12C21 8.23 21 6.34 19.83 5.17C18.66 4 16.77 4 13 4Z M3 10H21" />
  </Icon>
)
export const AiTabIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M17.37 16.27L20.47 15.28C21.58 14.92 21.87 13.49 20.96 12.75L18.54 10.75M17.37 16.27L17.24 19.39C17.19 20.53 15.92 21.18 14.94 20.58L12.12 18.84M12.12 18.84L9.44 20.72C8.5 21.38 7.19 20.8 7.07 19.68L6.74 16.52M6.74 16.52L3.62 15.71C2.48 15.42 2.12 14.01 2.97 13.22L5.29 11.06M5.29 11.06L4.01 8.24C3.53 7.19 4.4 6.03 5.56 6.17L8.85 6.57M8.85 6.57L10.41 3.77C10.96 2.78 12.39 2.74 13 3.69L14.75 6.43M14.75 6.43L17.98 5.85C19.13 5.65 20.06 6.75 19.66 7.82L18.54 10.75" />
  </Icon>
)
export const SubjectsTabIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15.5 7H8.5M12.5 11H8.5 M20 22H6C4.9 22 4 21.1 4 20M4 20C4 18.9 4.9 18 6 18H20V6C20 4.11 20 3.17 19.41 2.59C18.83 2 17.89 2 16 2H10C7.17 2 5.76 2 4.88 2.88C4 3.76 4 5.17 4 8V20Z" />
  </Icon>
)
export const ProgressTabIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21C7.76 21 5.64 21 4.32 19.68C3 18.36 3 16.24 3 12C3 7.76 3 5.64 4.32 4.32C5.64 3 7.76 3 12 3C16.24 3 18.36 3 19.68 4.32C21 5.64 21 7.76 21 12C21 16.24 21 18.36 19.68 19.68C18.36 21 16.24 21 12 21Z M8 17V10M12 17L12 7M16 17V13" />
  </Icon>
)
