import { InHeader } from '@/app/layout/ScreenHeader'

/** Title of a screen below the main ones, in the blue header under ‹ (board Izgled). */
export function ScreenTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <InHeader>
      <h1 className="text-[36px] leading-[1.02] font-bold">{title}</h1>
      {sub && <p className="mt-1.5 text-[15px] text-ground/85">{sub}</p>}
    </InHeader>
  )
}
