import { useTranslation } from 'react-i18next'
import { ScreenTitle } from '@/components/ScreenTitle'
import { Switch } from '@/components/Switch'
import { useLocale } from '@/features/settings/useLocale'
import { useVoiceSettings } from './store'
import { canSpeak } from './text'

const row = 'flex min-h-14 items-center gap-3 py-2 pr-3 pl-4 [&+&]:border-t [&+&]:border-hairline'

/**
 * Postavke → Glas (board "Postavke · glas", without the voice budget: Whisper and Kokoro run on
 * the phone, so there is no service and no limit). Reading aloud is English only for now.
 */
export function VoicePage() {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const { speakAloud, answerByVoice, set } = useVoiceSettings()
  const speaks = canSpeak(locale)
  return (
    <div className="flex flex-col gap-4">
      <ScreenTitle title={t('voice.title')} sub={t('voice.sub')} />
      <div className="surface overflow-hidden rounded-card">
        <div className={row}>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-bold">{t('voice.speak')}</span>
            <span className="text-[13px] leading-[1.35] text-ink-secondary">
              {speaks ? t('voice.speakSub') : t('voice.notInBosnian')}
            </span>
          </span>
          <Switch
            checked={speaks && speakAloud}
            disabled={!speaks}
            onChange={(v) => set({ speakAloud: v })}
            label={t('voice.speak')}
            hideLabel
          />
        </div>
        <div className={row}>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-bold">{t('voice.answer')}</span>
            <span className="text-[13px] leading-[1.35] text-ink-secondary">
              {t('voice.answerSub')}
            </span>
          </span>
          <Switch
            checked={answerByVoice}
            onChange={(v) => set({ answerByVoice: v })}
            label={t('voice.answer')}
            hideLabel
          />
        </div>
      </div>
      <h2 className="mt-3 px-1 font-display text-[22px] font-bold">{t('voice.howTitle')}</h2>
      <section className="surface flex flex-col gap-1.5 rounded-card px-[18px] py-4">
        <span className="text-[15px] font-bold">{t('voice.onPhone')}</span>
        <span className="text-[15px] leading-[22px] text-ink-secondary">
          {t('voice.onPhoneBody')}
        </span>
      </section>
      {!speaks && (
        <p className="px-1 text-[13px] leading-[1.4] text-ink-secondary">
          {t('voice.bosnianLater')}
        </p>
      )}
    </div>
  )
}
