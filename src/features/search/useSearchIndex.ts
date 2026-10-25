import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDocuments } from '@/features/owl/api'
import { useAllSources } from '@/features/plan/api'
import { useSubjects } from '@/features/subjects/api'
import { shownExams } from '@/features/subjects/model'
import { STATIC_ITEMS } from './items'
import type { SearchEntry } from './search'

const words = (list: string) =>
  list
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean)

/** Everything the search finds, from the locale and the query cache (offline after one visit). */
export function useSearchIndex(): SearchEntry[] {
  const { t } = useTranslation()
  const { data: subjects = [] } = useSubjects()
  const { data: sources = [] } = useAllSources()
  const { data: documents = [] } = useDocuments()

  return useMemo(() => {
    const subjectOf = new Map(subjects.map((s) => [s.id, s]))
    const entries: SearchEntry[] = STATIC_ITEMS.map((item) => ({
      id: item.id,
      group: item.group,
      to: item.to,
      title: t(`search.items.${item.id}.title`),
      sub: t(`search.items.${item.id}.sub`),
      keywords: words(t(`search.items.${item.id}.syn`)),
    }))
    for (const s of subjects) {
      if (s.archived) continue
      entries.push({
        id: `subject:${s.id}`,
        group: 'subjects',
        title: s.name,
        keywords: [],
        to: `/subjects/${s.id}`,
        color: s.color,
      })
      for (const a of shownExams(s.assessments))
        entries.push({
          id: `exam:${a.id}`,
          group: 'exams',
          title: `${a.title} · ${s.name}`,
          keywords: [],
          to: `/subjects/${s.id}`,
          color: s.color,
        })
    }
    for (const src of sources) {
      const subject = subjectOf.get(src.subject_id)
      if (!subject || subject.archived || src.is_rough) continue
      entries.push({
        id: `source:${src.id}`,
        group: 'sources',
        title: src.title,
        sub: subject.name,
        keywords: src.author ? [src.author] : [],
        to: `/subjects/${subject.id}/sources/${src.id}`,
        color: subject.color,
      })
      for (const u of src.units) {
        if (u.archived_at) continue
        const label = u.label && !u.label.startsWith('~') ? `${u.label} ` : ''
        entries.push({
          id: `unit:${u.id}`,
          group: 'units',
          title: `${label}${u.title}`,
          sub: `${subject.name} › ${src.title}`,
          keywords: [],
          to: `/subjects/${subject.id}/sources/${src.id}/units/${u.id}`,
          color: subject.color,
        })
      }
    }
    for (const d of documents)
      entries.push({
        id: `doc:${d.id}`,
        group: 'documents',
        title: d.title,
        sub: t(`owl.kind.${d.kind as 'other'}`),
        keywords: [],
        to: `/settings/documents/${d.id}`,
      })
    return entries
  }, [subjects, sources, documents, t])
}
