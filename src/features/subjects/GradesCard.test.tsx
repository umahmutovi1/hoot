import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import '@/app/i18n'
import { assessmentRow, deadlineRow, subjectRow } from './fixtures'
import { GradesCard } from './GradesCard'

vi.mock('@/features/settings/useLocale', () => ({ useLocale: () => ({ locale: 'bs' }) }))

// The mockup subject (BodoviOcjene, screen 1) with target grade 8.
const subject = {
  ...subjectRow({ target_grade: 8 }),
  assessments: [
    assessmentRow({
      id: 'p1',
      title: 'I parcijala',
      points_max: 40,
      pass_min_pct: 50,
      result_points: 32,
      result_max: 40,
      passed: true,
    }),
    assessmentRow({ id: 'p2', title: 'II parcijala', at: '2026-12-01T08:00:00Z', points_max: 40 }),
  ],
}
const deadlines = [
  deadlineRow({
    id: 'hw',
    subject_id: 's',
    title: 'Zadaće',
    points_max: 14,
    points_unit: 'percent',
    result_points: 14,
    result_max: 14,
  }),
  deadlineRow({
    id: 'sem',
    subject_id: 's',
    title: 'Seminarski',
    due_at: '2027-01-12T22:59:00Z',
    points_max: 6,
  }),
]

describe('GradesCard', () => {
  it('shows points so far and what the target grade needs', () => {
    render(<GradesCard subject={subject} deadlines={deadlines} onScale={() => {}} />)
    expect(screen.getByText('imaš 46 od 54 mogućih do sad')).toBeInTheDocument()
    expect(screen.getByText('Za 8 treba ti još 29 bodova')).toBeInTheDocument()
    expect(screen.getByText(/~63% na: II parcijala i Seminarski/)).toBeInTheDocument()
    expect(screen.getByText('nedostižno')).toBeInTheDocument()
  })

  it('explains how to start without points', () => {
    render(
      <GradesCard
        subject={{ ...subjectRow(), assessments: [] }}
        deadlines={[]}
        onScale={() => {}}
      />,
    )
    expect(screen.getByText(/Unesi koliko nose ispiti i rokovi/)).toBeInTheDocument()
  })
})
