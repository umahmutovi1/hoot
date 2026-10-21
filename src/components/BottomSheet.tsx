import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CloseIcon } from '@/components/icons'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface BottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle?: string
  /** Shown left of the title (the owl in "Šta učiš sad?"). */
  leading?: ReactNode
  children: ReactNode
}

/** Bottom sheet as in the UrediBlok mockups: white, 32 px top radius, handle, 22 px title, × to close. */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  leading,
  children,
}: BottomSheetProps) {
  const { t } = useTranslation()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        // Focus the sheet itself, not its first field: on mobile a focused <input type="time">
        // pops the native picker the moment the sheet opens.
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          const content = e.currentTarget as HTMLElement | null
          content?.focus()
        }}
        className="mx-auto max-h-[92dvh] w-full max-w-[430px] gap-4 overflow-y-auto rounded-t-[32px] border-none bg-surface px-5 pt-3 pb-[calc(24px+env(safe-area-inset-bottom))] text-ink shadow-none"
      >
        <span aria-hidden="true" className="h-[5px] w-10 self-center rounded-full bg-line" />
        <div className={cn('flex gap-3', leading ? 'items-center' : 'items-start')}>
          {leading}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <SheetTitle className="text-[22px] font-bold text-ink">{title}</SheetTitle>
            {subtitle ? (
              <SheetDescription className="text-sm text-ink-muted">{subtitle}</SheetDescription>
            ) : (
              <SheetDescription className="sr-only">{title}</SheetDescription>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t('common.close')}
            className="-mt-1 -mr-1 flex size-11 self-start shrink-0 items-center justify-center rounded-full bg-canvas text-ink-muted"
          >
            <CloseIcon size={16} />
          </button>
        </div>
        {children}
      </SheetContent>
    </Sheet>
  )
}
