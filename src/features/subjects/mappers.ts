import type { TablesInsert } from '@/types/database'
import {
  dueAtFromDate,
  examAtFromDate,
  isSubjectColor,
  localDateOf,
  type Assessment,
  type Deadline,
  type PointsUnit,
  type StudyMode,
  type SubjectWithAssessments,
} from './model'
import type { AssessmentForm, DeadlineForm, SubjectForm } from './schemas'

export function toSubjectRow(form: SubjectForm): TablesInsert<'subjects'> {
  return {
    id: form.id,
    name: form.name,
    color: form.color,
    priority: form.priority,
    study_mode: form.studyMode,
    campaign_start_on: form.studyMode === 'campaign' ? form.campaignStartOn : null,
    target_grade: form.targetGrade,
  }
}

export function toAssessmentRow(
  subjectId: string,
  form: AssessmentForm,
): TablesInsert<'assessments'> {
  return {
    id: form.id,
    subject_id: subjectId,
    kind: form.kind,
    title: form.title,
    at: examAtFromDate(form.date),
    format: form.format,
    scope_all: form.scopeAll,
    contingent: form.contingent,
    date_tentative: form.dateTentative,
    at_latest: form.dateTentative && form.dateLatest ? examAtFromDate(form.dateLatest) : null,
    exam_period_id: form.dateTentative ? form.examPeriodId : null,
    // A makeup carries the points of the exam it repeats.
    points_max: form.kind === 'makeup' ? null : form.pointsMax,
    points_unit: form.pointsUnit,
    pass_min_pct: form.passMinPct,
    entry_min_points: form.entryMinPoints,
    retake_of: form.kind === 'makeup' ? form.retakeOf : null,
  }
}

export function toDeadlineRow(form: DeadlineForm): TablesInsert<'deadlines'> {
  return {
    id: form.id,
    subject_id: form.subjectId,
    title: form.title,
    kind: form.kind,
    due_at: dueAtFromDate(form.date),
    est_minutes: form.estHours === null ? null : Math.round(form.estHours * 60),
    notes: form.notes || null,
    // Points only count within a subject.
    points_max: form.subjectId ? form.pointsMax : null,
    points_unit: form.pointsUnit,
    pass_min_pct: form.subjectId && form.pointsMax !== null ? form.passMinPct : null,
  }
}

export function assessmentToForm(a: Assessment): AssessmentForm {
  return {
    id: a.id,
    kind: a.kind,
    title: a.title,
    date: localDateOf(a.at),
    format: a.format,
    scopeAll: a.scope_all,
    contingent: a.contingent,
    dateTentative: a.date_tentative,
    dateLatest: a.at_latest ? localDateOf(a.at_latest) : null,
    examPeriodId: a.exam_period_id,
    pointsMax: a.points_max,
    pointsUnit: asPointsUnit(a.points_unit),
    passMinPct: a.pass_min_pct,
    entryMinPoints: a.entry_min_points,
    retakeOf: a.retake_of,
  }
}

export function subjectToForm(s: SubjectWithAssessments): SubjectForm {
  return {
    id: s.id,
    name: s.name,
    color: isSubjectColor(s.color) ? s.color : 'lavender',
    priority: s.priority,
    studyMode: s.study_mode as StudyMode,
    campaignStartOn: s.campaign_start_on,
    targetGrade: s.target_grade,
    assessments: [...s.assessments].sort((a, b) => a.at.localeCompare(b.at)).map(assessmentToForm),
  }
}

export function deadlineToForm(d: Deadline): DeadlineForm {
  return {
    id: d.id,
    subjectId: d.subject_id,
    title: d.title,
    kind: d.kind,
    date: localDateOf(d.due_at),
    estHours: d.est_minutes === null ? null : d.est_minutes / 60,
    notes: d.notes,
    pointsMax: d.points_max,
    pointsUnit: asPointsUnit(d.points_unit),
    passMinPct: d.pass_min_pct,
  }
}

function asPointsUnit(unit: string): PointsUnit {
  return unit === 'percent' ? 'percent' : 'points'
}
