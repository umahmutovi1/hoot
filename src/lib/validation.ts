import type bs from '@/locales/bs.json'

export type ValidationKey = `validation.${keyof (typeof bs)['validation']}`

/** Zod messages in Hoot schemas are i18n keys; unknown messages fall back to "required". */
export function validationKey(message: string | undefined): ValidationKey {
  return message?.startsWith('validation.') ? (message as ValidationKey) : 'validation.required'
}
