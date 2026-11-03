import type { TFunction } from 'i18next'
import type { StrategistAction } from '@/lib/strategist'
import type { Insight, InsightAction, Technique } from '@/lib/insights'

export function actionLabel(
  t: TFunction,
  a: StrategistAction | InsightAction,
  subjectName: string = '',
) {
  const values = { ...a, subject: subjectName }
  switch (a.kind) {
    case 'set_priority':
      return t('strategist.actions.set_priority', values)
    case 'boost_priority':
      return t('strategist.actions.boost_priority', values)
    case 'set_mode':
      return t('strategist.actions.set_mode', values)
    case 'set_campaign_start':
      return t('strategist.actions.set_campaign_start', values)
    case 'add_hours':
      return t('strategist.actions.add_hours', values)
    case 'drop_unit':
      return t('strategist.actions.drop_unit', { count: a.unitIds.length })
    case 'change_buffer':
      return t('strategist.actions.change_buffer', values)
    case 'reprioritize_unit':
      return t('strategist.actions.reprioritize_unit', values)
    case 'avoid_slot':
    case 'add_slot':
      return t(`strategist.actions.${a.kind}`, {
        part: t(`progress.parts.${a.part}`),
        days: t(a.weekend ? 'progress.slots.weekend' : 'progress.slots.weekday'),
      })
    case 'first_step':
      return t('strategist.actions.first_step', values)
    case 'set_preset':
      return t('progress.rhythm.apply', values)
    case 'strict_recall_gate':
      return t('strategist.actions.strict_recall_gate', values)
    case 'questions_next':
      return t('strategist.actions.questions_next', values)
    case 'end_by':
      return t('strategist.actions.end_by', values)
  }
}
export function insightCopy(t: TFunction, i: Insight, subject: string) {
  switch (i.kind) {
    case 'avoidance':
      return t('insights.copy.avoidance', { subject, count: i.postponed })
    case 'calibration':
      return t('insights.copy.calibration', {
        subject,
        pct: Math.round(i.overBy * 100),
        count: i.pairs,
      })
    case 'recall_share':
      return t('insights.copy.recall_share', {
        pct: Math.round(i.share * 100),
        hours: Math.round(i.minutes / 6) / 10,
      })
    case 'late_before_exam':
      return t('insights.copy.late_before_exam', { count: i.nights })
    case 'best_slot':
      return t('insights.copy.best_slot', {
        part: t(`progress.parts.${i.part}`),
        days: t(i.weekend ? 'progress.slots.weekend' : 'progress.slots.weekday'),
        focus: i.focus,
        count: i.sessions,
      })
    case 'distraction':
      return t('insights.copy.distraction', {
        part: t(`progress.parts.${i.part}`),
        leaves: i.leavesPer30,
        count: i.sessions,
      })
    case 'first_break':
      return t('insights.copy.first_break', { minutes: i.aboutMin, count: i.sessions })
    case 'speed':
      return t('insights.copy.speed', {
        mode: t(`session.mode.${i.mode}`),
        ratio: i.ratio,
        count: i.sessions,
      })
  }
}
export const techniqueLinks: Record<Technique, string> = {
  self_testing: 'https://www.psychologicalscience.org/journals/pspi/1529100612453266/',
  breaks: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12292963/',
  implementation_intentions: 'https://kops.uni-konstanz.de/handle/123456789/69905',
  calibration_feedback:
    'https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/07/Koriat_Bjork_2006_MC.pdf',
  sleep: 'https://www.nature.com/articles/s41539-019-0055-z',
}
