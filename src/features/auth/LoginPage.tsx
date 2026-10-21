import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { LocaleToggle } from '@/components/LocaleToggle'
import { SplashScreen } from '@/components/SplashScreen'
import { useLocale } from '@/features/settings/useLocale'
import { sendMagicLink, verifyEmailCode } from './api'
import { useAuth } from './auth-context'

const emailSchema = z.object({ email: z.email() })
const codeSchema = z.object({ code: z.string().regex(/^\d{6,10}$/) })

const inputClass =
  'h-[54px] rounded-input border-none glass px-4 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand-accent'

function EmailStep({ onSent }: { onSent: (email: string) => void }) {
  const { t } = useTranslation()
  const [failed, setFailed] = useState(false)
  const form = useForm({ resolver: zodResolver(emailSchema), defaultValues: { email: '' } })

  const submit = form.handleSubmit(async ({ email }) => {
    setFailed(false)
    try {
      await sendMagicLink(email)
      onSent(email)
    } catch {
      setFailed(true)
    }
  })

  const error = form.formState.errors.email
    ? t('auth.emailInvalid')
    : failed
      ? t('auth.sendFailed')
      : null

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
      <label className="mt-1.5 flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">{t('auth.email')}</span>
        <input
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={t('auth.emailPlaceholder')}
          aria-invalid={Boolean(error)}
          className={inputClass}
          {...form.register('email')}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" variant="ink" size="pill" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? t('auth.sending') : t('auth.sendLink')}
      </Button>
      <span className="text-center text-xs text-ink-muted">{t('auth.noPassword')}</span>
    </form>
  )
}

function CodeStep({ email, onBack }: { email: string; onBack: () => void }) {
  const { t } = useTranslation()
  const [failed, setFailed] = useState(false)
  const form = useForm({ resolver: zodResolver(codeSchema), defaultValues: { code: '' } })

  const submit = form.handleSubmit(async ({ code }) => {
    setFailed(false)
    try {
      await verifyEmailCode(email, code)
    } catch {
      setFailed(true)
    }
  })

  const invalid = Boolean(form.formState.errors.code) || failed

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
      <div className="rounded-card glass p-4">
        <h2 className="text-base font-semibold">{t('auth.checkEmailTitle')}</h2>
        <p className="mt-1 text-sm leading-snug text-ink-muted">
          {t('auth.checkEmailBody', { email })}
        </p>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">{t('auth.code')}</span>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder={t('auth.codePlaceholder')}
          aria-invalid={invalid}
          className={`${inputClass} tracking-[0.3em]`}
          {...form.register('code')}
        />
      </label>
      {invalid && (
        <p role="alert" className="text-sm text-danger">
          {t('auth.codeInvalid')}
        </p>
      )}
      <Button type="submit" variant="ink" size="pill" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? t('auth.verifying') : t('auth.verify')}
      </Button>
      <Button type="button" variant="link" onClick={onBack}>
        {t('auth.useOtherEmail')}
      </Button>
    </form>
  )
}

export function LoginPage() {
  const { t } = useTranslation()
  const { session, loading } = useAuth()
  const { locale, setLocale } = useLocale()
  const [sentTo, setSentTo] = useState<string | null>(null)

  if (loading) return <SplashScreen />
  if (session) return <Navigate to="/" replace />

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">
      <div className="relative flex h-[420px] shrink-0 items-center justify-center rounded-b-[48px] bg-brand-hero">
        <LocaleToggle
          value={locale}
          onChange={setLocale}
          variant="short"
          className="absolute top-6 right-5 bg-white/60"
        />
      </div>
      <div className="flex flex-1 flex-col gap-3.5 px-6 py-7">
        <h1 className="text-[30px] leading-[1.15] font-bold whitespace-pre-line">
          {t('auth.headline')}
        </h1>
        <p className="text-[15px] leading-snug text-ink-muted">{t('auth.lead')}</p>
        {sentTo ? (
          <CodeStep email={sentTo} onBack={() => setSentTo(null)} />
        ) : (
          <EmailStep onSent={setSentTo} />
        )}
      </div>
    </div>
  )
}
