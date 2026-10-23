import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { QUIZ_QUESTIONS } from '@shared/schemas.ts'
import { CameraIcon, DocIcon, SparkleIcon } from '@/components/icons'
import { useAllSources } from '@/features/plan/api'
import { useSubjects } from '@/features/subjects/api'
import { matchSubject } from '@/lib/import'
import { findChapter } from './findChapter'
import { useOwlStore, type OwlAction } from './store'

const card = 'flex flex-col gap-2 rounded-card glass p-3.5'
const button =
  'flex h-11 items-center justify-center gap-2 rounded-full btn-primary px-4 text-sm font-semibold'

/**
 * The tool next to an answer (Stage 10): notes found, a quiz, adding a timetable or contents.
 * Nothing changes until the user taps through and confirms on the screen it opens.
 */
export function ActionCard({ action }: { action: OwlAction }) {
  switch (action.kind) {
    case 'search_notes':
      return <NotesCard action={action} />
    case 'quiz':
      return <QuizCard text={action.text} />
    case 'add_timetable':
      return <TimetableCard />
    case 'add_contents':
      return <ContentsCard text={action.text} />
    case 'import_document':
      return action.documentId ? null : <NoDocumentCard />
  }
}

function NotesCard({ action }: { action: Extract<OwlAction, { kind: 'search_notes' }> }) {
  const { t } = useTranslation()
  if (action.hits === null)
    return <p className="text-sm text-danger">{t('owl.action.notesFailed')}</p>
  if (action.hits.length === 0)
    return (
      <p className="text-sm text-ink-muted">{t('owl.action.notesNone', { text: action.text })}</p>
    )
  return (
    <div className={card}>
      <span className="text-xs font-semibold text-brand-muted uppercase">
        {t('owl.action.notesTitle')}
      </span>
      {action.hits.map((h) => (
        <Link
          key={`${h.kind}:${h.unitId}:${h.snippet}`}
          to={`/subjects/${h.subjectId}/sources/${h.sourceId}/units/${h.unitId}`}
          className="flex min-h-11 flex-col gap-0.5 rounded-[14px] bg-white/50 px-3 py-2"
        >
          <span className="text-sm font-semibold">
            {h.title}
            {h.kind === 'card' && (
              <span className="font-normal text-ink-muted"> · {t('owl.action.card')}</span>
            )}
          </span>
          {h.snippet && <span className="text-xs text-ink-muted">{h.snippet}</span>}
        </Link>
      ))}
    </div>
  )
}

function QuizCard({ text }: { text: string }) {
  const { t } = useTranslation()
  const { data: sources = [] } = useAllSources()
  const chapters = sources
    .filter((s) => !s.is_rough)
    .flatMap((s) => s.units)
    .filter((u) => u.kind === 'chapter' && u.archived_at === null)
  const found = findChapter(text, chapters)
  if (!found) return <p className="text-sm text-ink-muted">{t('owl.action.quizNone', { text })}</p>
  return (
    <div className={card}>
      <span className="text-sm font-semibold">
        {[found.label, found.title].filter(Boolean).join(' ')}
      </span>
      <Link
        to={`/session/recall?units=${found.id}&quiz=1&to=${encodeURIComponent('/chat')}`}
        className={button}
      >
        <SparkleIcon size={16} />
        {t('recall.quizOffer', { count: QUIZ_QUESTIONS })}
      </Link>
    </div>
  )
}

function TimetableCard() {
  const { t } = useTranslation()
  const openSheet = useOwlStore((s) => s.openSheet)
  return (
    <button type="button" onClick={() => openSheet('timetable')} className={button}>
      <CameraIcon size={16} />
      {t('owl.action.timetable')}
    </button>
  )
}

function ContentsCard({ text }: { text: string | null }) {
  const { t } = useTranslation()
  const subjects = (useSubjects().data ?? []).filter((s) => !s.archived)
  const id = text ? matchSubject({ subject_id: null, subject_name: text }, subjects) : null
  const subject = subjects.find((s) => s.id === id)
  return (
    <Link to={subject ? `/subjects/${subject.id}/sources/new` : '/subjects'} className={button}>
      <DocIcon size={16} />
      {subject ? t('owl.action.contentsFor', { subject: subject.name }) : t('owl.action.contents')}
    </Link>
  )
}

function NoDocumentCard() {
  const { t } = useTranslation()
  const openSheet = useOwlStore((s) => s.openSheet)
  return (
    <button type="button" onClick={() => openSheet()} className={button}>
      <DocIcon size={16} />
      {t('owl.action.giveDocument')}
    </button>
  )
}
