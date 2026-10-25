import { NO_MEMORY, type Card, type Unit } from '@/features/sources/model'

// Rows for the review tests.

export const unit = (id: string, extra: Partial<Unit> = {}): Unit => ({
  id,
  user_id: 'u',
  source_id: 's',
  parent_id: null,
  kind: 'chapter',
  position: 0,
  label: id,
  title: id,
  page_start: null,
  read_amount: null,
  page_end: null,
  amount: 1,
  ai_difficulty: null,
  user_difficulty: null,
  est_minutes: 60,
  level: 1,
  confidence: null,
  notes: null,
  answer: null,
  answer_origin: null,
  completed_at: null,
  ...NO_MEMORY,
  next_review_on: null,
  archived_at: null,
  created_at: '',
  updated_at: '',
  ...extra,
})

export const card = (id: string, unitId: string): Card => ({
  id,
  user_id: 'u',
  unit_id: unitId,
  front: 'f',
  back: 'b',
  origin: 'user',
  created_at: '',
  updated_at: '',
  ...NO_MEMORY,
  next_review_on: null,
})
