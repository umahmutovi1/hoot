import type { Row } from './postgrest'

// Demo data for the landing screenshots (fictional student, no real account). Only the inputs:
// the app plans `plan_blocks` itself, as for a real user.

export const USER_ID = '00000000-0000-4000-8000-00000000d3e0'

/** Tuesday morning in the semester, Sarajevo time. */
export const NOW = '2026-11-03T08:20:00.000Z'

type Locale = 'bs' | 'en'

const T = {
  bs: {
    name: 'Lejla',
    subjects: ['Signali i sistemi', 'Matematika 2', 'Elektronika'],
    books: [
      'Signali i sistemi (Oppenheim)',
      'Zbirka zadataka iz Matematike 2',
      'Osnove elektronike',
    ],
    chapters: [
      [
        'Uvod u signale',
        'LTI sistemi',
        'Konvolucija',
        'Fourierov red',
        'Fourierova transformacija',
        'Uzorkovanje',
        'Laplaceova transformacija',
        'Z-transformacija',
      ],
      [
        'Nizovi i redovi',
        'Funkcije više varijabli',
        'Parcijalni izvodi',
        'Višestruki integrali',
        'Krivolinijski integrali',
        'Diferencijalne jednačine',
      ],
      [
        'Poluprovodnici',
        'Diode',
        'Bipolarni tranzistori',
        'MOSFET',
        'Pojačavači',
        'Operacioni pojačavači',
      ],
    ],
    exam: 'Završni ispit',
  },
  en: {
    name: 'Lejla',
    subjects: ['Signals and Systems', 'Mathematics 2', 'Electronics'],
    books: [
      'Signals and Systems (Oppenheim)',
      'Mathematics 2 problem book',
      'Fundamentals of Electronics',
    ],
    chapters: [
      [
        'Introduction to signals',
        'LTI systems',
        'Convolution',
        'Fourier series',
        'Fourier transform',
        'Sampling',
        'Laplace transform',
        'Z-transform',
      ],
      [
        'Sequences and series',
        'Functions of several variables',
        'Partial derivatives',
        'Multiple integrals',
        'Line integrals',
        'Differential equations',
      ],
      [
        'Semiconductors',
        'Diodes',
        'Bipolar transistors',
        'MOSFET',
        'Amplifiers',
        'Operational amplifiers',
      ],
    ],
    exam: 'Final exam',
  },
}

const id = (prefix: string, n: number) =>
  `00000000-0000-4000-8000-${prefix}${String(n).padStart(12 - prefix.length, '0')}`

const day = (offset: number, hhmm = '09:00') => {
  const d = new Date(NOW)
  d.setUTCDate(d.getUTCDate() + offset)
  const [h, m] = hhmm.split(':').map(Number)
  d.setUTCHours(h! - 1, m!, 0, 0) // Sarajevo is UTC+1 in November
  return d.toISOString()
}
const date = (offset: number) => day(offset).slice(0, 10)

export function seed(locale: Locale): Record<string, Row[]> {
  const t = T[locale]
  const examIn = [12, 19, 26]
  const pagesPer = [24, 18, 20]
  const subjects: Row[] = []
  const assessments: Row[] = []
  const sources: Row[] = []
  const units: Row[] = []
  t.subjects.forEach((name, i) => {
    const subjectId = id('a', i)
    subjects.push({
      id: subjectId,
      name,
      priority: i === 0 ? 2 : 3,
      target_grade: 8,
      color: ['lavender', 'pink', 'blue'][i],
    })
    assessments.push({
      id: id('b', i),
      subject_id: subjectId,
      title: t.exam,
      kind: 'final',
      at: day(examIn[i]!, '10:00'),
    })
    const sourceId = id('c', i)
    sources.push({
      id: sourceId,
      subject_id: subjectId,
      kind: 'book',
      title: t.books[i],
      base_min_per_unit: 3,
      measure: 'pages',
    })
    let page = 1
    t.chapters[i]!.forEach((title, k) => {
      const done = k < [3, 2, 1][i]!
      units.push({
        id: id(`d${i}`, k),
        source_id: sourceId,
        position: k,
        label: String(k + 1),
        title,
        page_start: page,
        page_end: page + pagesPer[i]! - 1,
        amount: pagesPer[i],
        level: done ? 2 : 0,
        completed_at: done ? day(-10 + k, '18:00') : null,
        read_amount: done ? pagesPer[i] : null,
        last_review_at: done ? day(-10 + k, '18:00') : null,
        // One chapter is due for review today.
        next_review_on: done ? date(i === 1 && k === 0 ? 0 : 3 + k) : null,
        fsrs_state: done ? 2 : null,
        fsrs_stability: done ? 6 : null,
        fsrs_difficulty: done ? 5 : null,
        fsrs_reps: done ? 1 : 0,
      })
      page += pagesPer[i]!
    })
  })

  // Earlier this week: Monday's sessions, so the week ring is not empty.
  const study_sessions: Row[] = [
    {
      id: id('e', 0),
      subject_id: id('a', 0),
      started_at: day(-1, '10:00'),
      ended_at: day(-1, '10:50'),
      mode: 'reading',
      origin: 'timer',
      planned_minutes: 50,
      focus: 4,
    },
    {
      id: id('e', 1),
      subject_id: id('a', 1),
      started_at: day(-1, '16:00'),
      ended_at: day(-1, '16:45'),
      mode: 'problems',
      origin: 'timer',
      planned_minutes: 45,
      focus: 3,
    },
  ]
  const study_segments: Row[] = study_sessions.map((s, i) => ({
    id: id('f', i),
    session_id: s.id,
    started_at: s.started_at,
    ended_at: s.ended_at,
  }))

  return {
    profiles: [
      {
        id: USER_ID,
        display_name: t.name,
        name_confirmed_at: day(-30),
        locale,
        onboarded_at: day(-30),
        onboarding_step: 8,
        wake_min: 7 * 60,
        sleep_min: 23 * 60,
      },
    ],
    availability_rules: Array.from({ length: 7 }, (_, d) => ({
      id: id('9', d),
      weekday: d,
      start_min: 9 * 60,
      end_min: 21 * 60,
    })),
    subjects,
    assessments,
    sources,
    units,
    study_sessions,
    study_segments,
  }
}

/** The signed-in session supabase-js keeps in localStorage (`sb-<ref>-auth-token`). */
export function session() {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const exp = Math.floor(new Date(NOW).getTime() / 1000) + 365 * 86400
  const user = {
    id: USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'demo@hoot.app',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { password_set: true },
    created_at: day(-30),
  }
  const access_token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER_ID, role: 'authenticated', aud: 'authenticated', exp, email: user.email })}.demo`
  return {
    user,
    session: {
      access_token,
      refresh_token: 'demo',
      token_type: 'bearer',
      expires_in: 3600 * 24 * 365,
      expires_at: exp,
      user,
    },
  }
}
