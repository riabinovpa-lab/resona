import type { IconName } from '../types'

type IconProps = { name: IconName; size?: number }

export function Icon({ name, size = 18 }: IconProps) {
  const s = { width: size, height: size }
  switch (name) {
    case 'home':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...s}>
          <path d="M4 11.5 12 5l8 6.5V20H4v-8.5Z" />
        </svg>
      )
    case 'calendar':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...s}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3.5v3M16 3.5v3M4 10h16" />
        </svg>
      )
    case 'mic':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...s}>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M6 11a6 6 0 0 0 12 0M12 17v4" />
        </svg>
      )
    case 'chart':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...s}>
          <path d="M5 19V9M12 19V5M19 19v-7" />
        </svg>
      )
    case 'more':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" {...s}>
          <circle cx="6" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="18" cy="12" r="1.6" />
        </svg>
      )
    case 'people':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...s}>
          <circle cx="9" cy="8" r="3" />
          <path d="M4 19c.6-3 2.6-4.5 5-4.5S13.4 16 14 19" />
          <circle cx="16.5" cy="8.5" r="2.4" />
          <path d="M16 14.6c2.2.3 3.8 1.7 4.3 4.4" />
        </svg>
      )
    case 'chat':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...s}>
          <path d="M5 6h14v10H8l-3 3V6Z" />
        </svg>
      )
    case 'bell':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...s}>
          <path d="M7 10a5 5 0 0 1 10 0c0 4 1.5 5.5 1.5 5.5h-13S7 14 7 10Z" />
          <path d="M10.5 19a1.8 1.8 0 0 0 3 0" />
        </svg>
      )
    case 'pin':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...s}>
          <path d="M12 21s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10Z" />
          <circle cx="12" cy="11" r="2.2" />
        </svg>
      )
    case 'book':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...s}>
          <path d="M5 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H5V5Z" />
          <path d="M19 5h-6v12h6V5Z" />
        </svg>
      )
    case 'star':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...s}>
          <path d="m12 4 2.3 4.9 5.2.7-3.8 3.7 1 5.3-4.7-2.6-4.7 2.6 1-5.3L4.5 9.6l5.2-.7L12 4Z" />
        </svg>
      )
    case 'card':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...s}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 10h18" />
        </svg>
      )
    case 'back':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...s}>
          <path d="M14.5 5.5 8 12l6.5 6.5" />
        </svg>
      )
    case 'check':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...s}>
          <path d="m5 12.5 4.5 4.5L19 7" />
        </svg>
      )
    default:
      return null
  }
}
