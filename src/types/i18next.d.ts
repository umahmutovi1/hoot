import 'i18next'
import type bs from '@/locales/bs.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof bs }
  }
}
