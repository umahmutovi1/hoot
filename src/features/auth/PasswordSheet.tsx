import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { useToast } from '@/components/toast-store'
import { Button } from '@/components/ui/button'
import { setPassword, skipPasswordPrompt } from './api'
import { useAuth } from './auth-context'

const PASSWORD_MIN = 8

const schema = z.object({ password: z.string().min(PASSWORD_MIN) })

/**
 * "Postavi lozinku" (PrijavaLozinka.dc.html): once after a sign-in with the email code, with
 * "Preskoči"; from Postavke (`prompt` off) it only sets or changes the password.
 */
export function PasswordSheet({
  open,
  onOpenChange,
  prompt = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  prompt?: boolean
}) {
  const { t } = useTranslation()
  const success = useToast((s) => s.success)
  const [failed, setFailed] = useState(false)
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { password: '' } })

  const close = (o: boolean) => {
    // Closing the one-time prompt in any way counts as "Preskoči".
    if (!o && prompt) void skipPasswordPrompt().catch(() => undefined)
    onOpenChange(o)
  }

  const submit = form.handleSubmit(async ({ password }) => {
    setFailed(false)
    try {
      await setPassword(password)
      success(t('auth.passwordSaved'))
      onOpenChange(false)
    } catch {
      setFailed(true)
    }
  })

  return (
    <BottomSheet open={open} onOpenChange={close} title={t('auth.setPassword')}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-3.5 pb-2">
        <p className="text-[15px] leading-snug text-ink-secondary">{t('auth.setPasswordBody')}</p>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">{t('auth.newPassword')}</span>
          <input
            type="password"
            autoComplete="new-password"
            placeholder={t('auth.newPasswordPlaceholder', { count: PASSWORD_MIN })}
            aria-invalid={Boolean(form.formState.errors.password) || failed}
            className="h-[54px] rounded-input border-none surface px-4 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
            {...form.register('password')}
          />
        </label>
        {(form.formState.errors.password || failed) && (
          <p role="alert" className="text-sm text-danger">
            {failed ? t('auth.passwordFailed') : t('auth.passwordShort', { count: PASSWORD_MIN })}
          </p>
        )}
        <Button type="submit" size="pill" disabled={form.formState.isSubmitting}>
          {t('auth.savePassword')}
        </Button>
        {prompt && (
          <Button type="button" variant="link" onClick={() => close(false)}>
            {t('auth.skip')}
          </Button>
        )}
      </form>
    </BottomSheet>
  )
}

/**
 * Offers the password once to an email account that has neither set one nor skipped it. Google
 * accounts never see it.
 */
export function PasswordPrompt() {
  const user = useAuth().session?.user
  const [dismissed, setDismissed] = useState(false)
  const due =
    !!user &&
    user.app_metadata?.provider === 'email' &&
    !user.user_metadata?.password_set &&
    !user.user_metadata?.password_prompted
  return (
    <PasswordSheet open={due && !dismissed} onOpenChange={(o) => !o && setDismissed(true)} prompt />
  )
}
