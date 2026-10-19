import type { AssessmentKind } from './model'

export const EXAM_PRESETS = ['final', 'partials', 'custom'] as const
export type ExamPreset = (typeof EXAM_PRESETS)[number]

/** One exam row a preset creates; the title comes from i18n (`subjects.examTitle.<titleKey>`). */
export interface PresetExam {
  kind: AssessmentKind
  titleKey: 'final' | 'partial1' | 'partial2' | 'integral'
  scopeAll: boolean
  contingent: boolean
}

export function presetExams(preset: ExamPreset): PresetExam[] {
  switch (preset) {
    case 'final':
      return [{ kind: 'final', titleKey: 'final', scopeAll: true, contingent: false }]
    case 'partials':
      return [
        { kind: 'partial', titleKey: 'partial1', scopeAll: false, contingent: false },
        { kind: 'partial', titleKey: 'partial2', scopeAll: false, contingent: false },
        // Integral is only taken if a partial is failed, so it is not planned ahead.
        { kind: 'integral', titleKey: 'integral', scopeAll: true, contingent: true },
      ]
    case 'custom':
      return []
  }
}
