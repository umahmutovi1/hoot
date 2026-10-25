import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CloseIcon } from '@/components/icons'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHandle,
  DrawerTitle,
} from '@/components/ui/drawer'
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

/**
 * Bottom sheet as in the UrediBlok mockups: white, 32 px top radius, handle, 22 px title, × to close.
 * It slides in on the iOS curve and follows the finger: dragging the handle down closes it (only
 * the handle, so forms, text selection and scrolling inside keep working; design README, 10b;
 * timing in index.css). The keyboard inset comes from `--vv-bottom`, so vaul does not reposition inputs.
 */
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
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false} handleOnly>
      <DrawerContent
        // Focus the sheet itself, not its first field: on mobile a focused <input type="time">
        // pops the native picker the moment the sheet opens.
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          const content = e.currentTarget as HTMLElement | null
          content?.focus()
        }}
        className="mx-auto max-h-[92dvh] w-full max-w-[430px] gap-4 overflow-y-auto rounded-t-[32px] px-5 outline-none pt-3 pb-[calc(24px+env(safe-area-inset-bottom)+var(--vv-bottom,0px))] text-ink"
      >
        {/* vaul's handle; its hit area is 44 px, wider than the 40 × 5 bar. */}
        <DrawerHandle className="h-[5px]! w-10! shrink-0 rounded-full! bg-line! opacity-100!" />
        <div className={cn('flex gap-3', leading ? 'items-center' : 'items-start')}>
          {leading}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <DrawerTitle className="text-[22px] font-bold text-ink">{title}</DrawerTitle>
            {subtitle ? (
              <DrawerDescription className="text-sm text-ink-muted">{subtitle}</DrawerDescription>
            ) : (
              <DrawerDescription className="sr-only">{title}</DrawerDescription>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t('common.close')}
            className="-mt-1 -mr-1 flex size-11 self-start shrink-0 items-center justify-center rounded-full bg-canvas text-ink-secondary"
          >
            <CloseIcon size={16} />
          </button>
        </div>
        {children}
      </DrawerContent>
    </Drawer>
  )
}
