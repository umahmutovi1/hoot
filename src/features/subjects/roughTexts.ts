import { useTranslation } from 'react-i18next'
import type { RoughSize } from '@/lib/estimates/rough'

/** The temporary source's localized texts. */
export function useRoughTexts() {
  const { t } = useTranslation()
  return (size: RoughSize) => ({
    title: t(`subjects.rough.sourceTitle.${size}`),
    partTitle: (n: number) => t('subjects.rough.part', { n }),
  })
}
