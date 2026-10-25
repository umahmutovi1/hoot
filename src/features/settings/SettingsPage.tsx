import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Avatar } from '@/components/Avatar'
import { ScreenTitle } from '@/components/ScreenTitle'
import { LocaleToggle } from '@/components/LocaleToggle'
import { signOut } from '@/features/auth/api'
import { useCalendarFeeds } from '@/features/calendars/api'
import { useDocuments } from '@/features/owl/api'
import { useScheduleData } from '@/features/schedule/useScheduleData'
import { formatDuration } from '@/features/sources/format'
import { formatPoints } from '@/features/subjects/grades'
import { ScaleSheet } from '@/features/subjects/ScaleSheet'
import { localDay } from '@/lib/day'
import { cn } from '@/lib/utils'
import { DisplayNameForm } from './DisplayNameForm'
import { NotifySettings } from '@/features/notify/NotifySettings'
import { ThemeSwatch } from './AppearancePage'
import { isTheme } from './theme'
import { AnkiExport } from './AnkiExport'
import { PresetSettings } from './PresetSettings'
import { useDayBoundary, useProfile } from './profile'
import { useLocale } from './useLocale'

export function SettingsPage() {
  const { t } = useTranslation()
  const { data: profile } = useProfile()
  const theme = isTheme(profile?.theme) ? profile.theme : 'lavender'
  const { locale, setLocale } = useLocale()
  const name = profile?.display_name ?? ''
  const [editingName, setEditingName] = useState(false)
  const [scaleOpen, setScaleOpen] = useState(false)
  const boundary = useDayBoundary()
  const [today] = useState(() => localDay(new Date(), boundary))
  const schedule = useScheduleData()
  const documents = useDocuments().data
  const feeds = useCalendarFeeds().data
  const row = 'flex items-center justify-between border-b border-canvas py-3.5'

  return (
    <div className="flex flex-1 flex-col gap-3.5">
      <ScreenTitle title={t('settings.title')} />

      {editingName ? (
        <div className="rounded-card glass p-4">
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
          className="flex items-center gap-3.5 rounded-card glass p-4 text-left"
        >
          <Avatar name={name} className="size-[52px] text-xl" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[17px] font-semibold">{name}</span>
            <span className="text-[13px] text-ink-muted">{t('settings.signedInWith')}</span>
          </div>
        </button>
      )}

      <h2
        id="general"
        className="scroll-mt-[calc(84px+env(safe-area-inset-top))] px-1 pt-1 text-[13px] font-semibold text-ink-muted uppercase"
      >
        {t('settings.general')}
      </h2>
      <div className="flex flex-col rounded-card glass px-4 py-1.5">
        <div className="flex items-center justify-between border-b border-canvas py-2.5">
          <span className="text-[15px]">{t('settings.language')}</span>
          <LocaleToggle value={locale} onChange={setLocale} className="bg-canvas" />
        </div>
        <Link to="/settings/academic" className={row}>
          <span className="flex flex-col gap-0.5">
            <span className="text-[15px]">{t('academic.faculty.row')}</span>
            <span className="text-xs text-ink-muted">
              {profile?.institution && profile.year_of_study
                ? t('academic.faculty.rowValue', {
                    institution: profile.institution,
                    n: profile.year_of_study,
                  })
                : t('academic.faculty.rowEmpty')}
            </span>
          </span>
          <span className="text-sm text-ink-muted">›</span>
        </Link>
        <Link to="/settings/appearance" className={row}>
          <span className="flex flex-col gap-0.5">
            <span className="text-[15px]">{t('appearance.row')}</span>
            <span className="text-xs text-ink-muted">{t('appearance.rowSub')}</span>
          </span>
          <span className="flex items-center gap-2 text-sm text-ink-muted">
            <ThemeSwatch theme={theme} size={22} />
            {t(`appearance.theme.${theme}.name`)} ›
          </span>
        </Link>
        <Link to="/plan/availability" className={row}>
          <span className="text-[15px]">{t('availability.title')}</span>
          <span className="text-sm text-ink-muted">
            {t('availability.perWeek', {
              hours: formatDuration(t, schedule.weekMinutes(today)),
            })}{' '}
            ›
          </span>
        </Link>
        <Link to="/settings/calendar" className={row}>
          <span className="text-[15px]">{t('calendar.title')}</span>
          <span className="text-sm text-ink-muted">
            {t('settings.periodsCount', { count: schedule.periodRows.length })} ›
          </span>
        </Link>
        <Link to="/settings/feeds" className={row}>
          <span className="text-[15px]">{t('feeds.title')}</span>
          <span className="text-sm text-ink-muted">{feeds?.length ?? 0} ›</span>
        </Link>
        <button type="button" onClick={() => setScaleOpen(true)} className={cn(row, 'text-left')}>
          <span className="text-[15px]">{t('settings.grades')}</span>
          <span className="text-sm text-ink-muted">
            {t('settings.gradesValue', {
              total: formatPoints(profile?.points_total ?? 100, locale),
            })}
          </span>
        </button>
        <Link to="/settings/documents" className={row}>
          <span className="text-[15px]">{t('owl.documents.title')}</span>
          <span className="text-sm text-ink-muted">
            {t('owl.documents.count', { count: documents?.length ?? 0 })} ›
          </span>
        </Link>
        <div className="flex items-center justify-between py-3.5">
          <span className="text-[15px]">{t('settings.timezone')}</span>
          <span className="text-sm text-ink-muted">{profile?.timezone}</span>
        </div>
      </div>

      <h2
        id="session"
        className="scroll-mt-[calc(84px+env(safe-area-inset-top))] px-1 pt-1 text-[13px] font-semibold text-ink-muted uppercase"
      >
        {t('settings.session')}
      </h2>
      <PresetSettings />

      <h2
        id="notify"
        className="scroll-mt-[calc(84px+env(safe-area-inset-top))] px-1 pt-1 text-[13px] font-semibold text-ink-muted uppercase"
      >
        {t('notify.title')}
      </h2>
      <NotifySettings />

      <h2
        id="data"
        className="scroll-mt-[calc(84px+env(safe-area-inset-top))] px-1 pt-1 text-[13px] font-semibold text-ink-muted uppercase"
      >
        {t('settings.data')}
      </h2>
      <div className="flex flex-col rounded-card glass px-4">
        <AnkiExport className={cn(row, 'last:border-b-0')} />
      </div>

      <ScaleSheet open={scaleOpen} onOpenChange={setScaleOpen} />

      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-auto h-[52px] rounded-full glass text-[15px] font-semibold text-danger"
      >
        {t('settings.signOut')}
      </button>
    </div>
  )
}
