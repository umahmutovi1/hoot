import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { LocaleToggle } from '@/components/LocaleToggle'
import { Logo } from '@/components/Logo'
import { SplashScreen } from '@/components/SplashScreen'
import { useLocale } from '@/features/settings/useLocale'
import { sendMagicLink, signInWithGoogle, signInWithPassword, verifyEmailCode } from './api'
import { useAuth } from './auth-context'

const emailSchema = z.object({ email: z.email(), password: z.string() })
const codeSchema = z.object({ code: z.string().regex(/^\d{6,10}$/) })

const inputClass =
  'h-[54px] rounded-input border-none glass px-4 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand-accent'

function EmailStep({ onSent }: { onSent: (email: string) => void }) {
  const { t } = useTranslation()
  const [failed, setFailed] = useState<'send' | 'password' | 'google' | null>(null)
  const [sending, setSending] = useState(false)
  const form = useForm({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '', password: '' },
  })

  const sendCode = form.handleSubmit(async ({ email }) => {
    setFailed(null)
    setSending(true)
    try {
      await sendMagicLink(email)
      onSent(email)
    } catch {
      setFailed('send')
    } finally {
      setSending(false)
    }
  })

  // Without a password "Prijavi se" sends the code, so the first sign-in is the same button.
  const submit = form.handleSubmit(async ({ email, password }) => {
    if (!password) return sendCode()
    setFailed(null)
    try {
      await signInWithPassword(email, password)
    } catch {
      setFailed('password')
    }
  })

  const google = async () => {
    setFailed(null)
    try {
      await signInWithGoogle()
    } catch {
      setFailed('google')
    }
  }

  const error = form.formState.errors.email
    ? t('auth.emailInvalid')
    : failed === 'send'
      ? t('auth.sendFailed')
      : failed === 'password'
        ? t('auth.passwordWrong')
        : failed === 'google'
          ? t('auth.googleFailed')
          : null
  const busy = form.formState.isSubmitting || sending

  return (
    <div className="flex flex-col gap-3.5">
      <Button type="button" variant="surface" size="pill" onClick={() => void google()}>
        <GoogleMark />
        {t('auth.google')}
      </Button>
      <div className="flex items-center gap-2.5 text-xs text-ink-muted">
        <span className="h-px flex-1 bg-ink/14" />
        {t('auth.orEmail')}
        <span className="h-px flex-1 bg-ink/14" />
      </div>
      <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">{t('auth.email')}</span>
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={t('auth.emailPlaceholder')}
            aria-invalid={Boolean(form.formState.errors.email)}
            className={inputClass}
            {...form.register('email')}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">{t('auth.password')}</span>
          <input
            type="password"
            autoComplete="current-password"
            placeholder={t('auth.passwordPlaceholder')}
            aria-invalid={failed === 'password'}
            className={inputClass}
            {...form.register('password')}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="ink" size="pill" disabled={busy}>
          {busy ? t('auth.signingIn') : t('auth.signIn')}
        </Button>
        <Button type="button" variant="link" disabled={busy} onClick={() => void sendCode()}>
          {sending ? t('auth.sending') : t('auth.sendCode')}
        </Button>
        <span className="text-center text-xs text-ink-muted">{t('auth.codeHint')}</span>
      </form>
    </div>
  )
}

/** Google's "G" in its own colours (brand guidelines), not a stroke icon. */
function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.2-4.8 3.2-8z"
      />
      <path
        fill="#34A853"
        d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"
      />
      <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.4V7H2.1a11 11 0 0 0 0 9.9z" />
      <path
        fill="#EA4335"
        d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"
      />
    </svg>
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
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-3.5 px-6 pt-[calc(24px+env(safe-area-inset-top))] pb-8">
      <div className="flex h-11 items-center justify-between">
        <Link to="/" aria-label="Hoot">
          <Logo size={40} />
        </Link>
        <LocaleToggle value={locale} onChange={setLocale} variant="short" className="bg-white/60" />
      </div>
      <h1 className="mt-4 text-[30px] leading-[1.15] font-bold">{t('auth.title')}</h1>
      <p className="text-[15px] leading-snug text-ink-secondary">{t('auth.firstTime')}</p>
      {sentTo ? (
        <CodeStep email={sentTo} onBack={() => setSentTo(null)} />
      ) : (
        <EmailStep onSent={setSentTo} />
      )}
    </div>
  )
}
