import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '@/components/Avatar'
import { BackHeader } from '@/components/BackHeader'
import { LocaleToggle } from '@/components/LocaleToggle'
import { signOut } from '@/features/auth/api'
import { DisplayNameForm } from './DisplayNameForm'
import { useProfile } from './profile'
import { useLocale } from './useLocale'

export function SettingsPage() {
  const { t } = useTranslation()
  const { data: profile } = useProfile()
  const { locale, setLocale } = useLocale()
  const name = profile?.display_name ?? ''
  const [editingName, setEditingName] = useState(false)

  return (
    <div className="flex min-h-[calc(100dvh-48px)] flex-col gap-3.5">
      <BackHeader title={t('settings.title')} fallback="/progress" />

      {editingName ? (
        <div className="rounded-card bg-surface p-4">
          <DisplayNameForm
            initialName={name}
            submitLabel={t('common.save')}
            inputClassName="bg-canvas"
            onSaved={() => setEditingName(false)}
            onCancel={() => setEditingName(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditingName(true)}
          aria-label={t('profile.editName')}
          className="flex items-center gap-3.5 rounded-card bg-surface p-4 text-left"
        >
          <Avatar name={name} className="size-[52px] text-xl" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[17px] font-semibold">{name}</span>
            <span className="text-[13px] text-ink-muted">{t('settings.signedInWith')}</span>
          </div>
        </button>
      )}

      <h2 className="px-1 pt-1 text-[13px] font-semibold text-ink-muted uppercase">
        {t('settings.general')}
      </h2>
      <div className="flex flex-col rounded-card bg-surface px-4 py-1.5">
        <div className="flex items-center justify-between border-b border-canvas py-2.5">
          <span className="text-[15px]">{t('settings.language')}</span>
          <LocaleToggle value={locale} onChange={setLocale} className="bg-canvas" />
        </div>
        <div className="flex items-center justify-between py-3.5">
          <span className="text-[15px]">{t('settings.timezone')}</span>
          <span className="text-sm text-ink-muted">{profile?.timezone}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-auto h-[52px] rounded-full bg-surface text-[15px] font-semibold text-danger"
      >
        {t('settings.signOut')}
      </button>
    </div>
  )
}
