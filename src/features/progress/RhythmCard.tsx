import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_CUSTOM_PRESETS } from '@shared/schemas.ts'
import { useSessions } from '@/features/session/api'
import { toSegment } from '@/features/session/model'
import { usePresets } from '@/features/session/presets'
import { useUpdateProfile } from '@/features/settings/profile'
import { usePlanStore } from '@/features/plan/store'
import { rhythmSuggestion, sessionRhythm } from '@/lib/session/rhythm'
import { Button } from '@/components/ui/button'

export function RhythmCard() {
  const { t } = useTranslation()
  const [now] = useState(() => new Date())
  const { data: sessions = [] } = useSessions()
  const presets = usePresets()
  const update = useUpdateProfile()
  const replan = usePlanStore((s) => s.replanNow)
  const [dismissed, setDismissed] = useState(false)
  const suggestion = rhythmSuggestion(
    sessionRhythm(
      sessions
        .filter((s) => s.origin === 'timer' && s.ended_at)
        .map((s) => ({
          endedAt: new Date(s.ended_at!),
          segments: s.study_segments.map(toSegment),
          plannedMinutes: s.planned_minutes,
        })),
      now,
    ),
    presets.resolve(presets.defaultId),
  )
  if (!suggestion || dismissed) return null
  const { workMin, breakMin, aboutMin } = suggestion
  const full = presets.custom.length >= MAX_CUSTOM_PRESETS
  return (
    <section className="glass flex flex-col gap-3 rounded-card p-4">
      <h2 className="text-base font-semibold">{t('progress.rhythm.title')}</h2>
      <p className="text-sm text-ink-secondary">
        {t('progress.rhythm.suggestion', { aboutMin, workMin, breakMin })}
      </p>
      {full ? (
        <p className="text-xs text-ink-muted">{t('progress.rhythm.full')}</p>
      ) : (
        <Button
          className="btn-primary min-h-11 rounded-full"
          disabled={update.isPending}
          onClick={() => {
            const id = `custom:${crypto.randomUUID()}`
            update.mutate(
              {
                session_presets: [
                  ...presets.custom,
                  {
                    id,
                    name: t('progress.rhythm.name', { workMin, breakMin }),
                    steps: [
                      { kind: 'work', min: workMin },
                      { kind: 'break', min: breakMin },
                    ],
                    long_break: null,
                  },
                ],
                default_preset: id,
              },
              { onSuccess: replan },
            )
          }}
        >
          {t('progress.rhythm.apply', { workMin, breakMin })}
        </Button>
      )}
      <button
        type="button"
        className="min-h-11 text-sm text-brand"
        onClick={() => setDismissed(true)}
      >
        {t('progress.rhythm.later')}
      </button>
    </section>
  )
}
