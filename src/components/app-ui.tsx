import type { ReactNode } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function Initials({
  text,
  className,
  size = 'sm',
}: {
  text: string
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <Avatar className={cn(size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-10 w-10 text-xs', className)}>
      <AvatarFallback className="bg-[#3a2d22] font-semibold text-primary">{text}</AvatarFallback>
    </Avatar>
  )
}

const tones = {
  ok: 'border-transparent bg-[var(--ok-bg)] text-[var(--ok)] hover:bg-[var(--ok-bg)]',
  warn: 'border-transparent bg-[var(--warn-bg)] text-[var(--warn)] hover:bg-[var(--warn-bg)]',
  bad: 'border-transparent bg-[var(--bad-bg)] text-[var(--bad)] hover:bg-[var(--bad-bg)]',
  neutral: 'border-transparent bg-secondary text-muted-foreground hover:bg-secondary',
} as const

export function StatusBadge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: keyof typeof tones
  children: ReactNode
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn('rounded-full font-medium shadow-none', tones[tone], className)}>
      {children}
    </Badge>
  )
}

export function SoftCard({
  variant = 'default',
  className,
  children,
  ...props
}: React.ComponentProps<typeof Card> & { variant?: 'default' | 'hero' | 'alert' }) {
  return (
    <Card
      className={cn(
        'gap-0 border-border bg-card p-4 shadow-none',
        variant === 'hero' && 'hero p-5',
        variant === 'alert' && 'alert p-5',
        className,
      )}
      {...props}
    >
      {children}
    </Card>
  )
}

export function paymentTone(status: 'paid' | 'due' | 'overdue') {
  if (status === 'paid') return 'ok' as const
  if (status === 'due') return 'warn' as const
  return 'bad' as const
}
