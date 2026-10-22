/** Title of a screen below the main ones; ‹ and the path are in the breadcrumbs above it. */
export function ScreenTitle({ title }: { title: string }) {
  return <h1 className="text-[26px] leading-tight font-bold tracking-[-0.4px]">{title}</h1>
}
