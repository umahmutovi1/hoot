import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AiCallError } from '@/features/owl/api'
import { documentFromLink } from '@/features/owl/link'
import { useOwlStore, type ImportProposal } from '@/features/owl/store'
import { useOwl } from '@/features/owl/useOwl'
import { useProfile } from '@/features/settings/profile'

/**
 * After a whole study programme from a link is saved (PRD "Studijski program s interneta"): one
 * card reads the same document as the plan and programme of the user's year (books, topics,
 * grading), through the same review.
 */
export function ProgramDetailsCard({ proposal }: { proposal: ImportProposal }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const owl = useOwl()
  const year = useProfile().data?.year_of_study ?? null
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [found, setFound] = useState<number | null>(null)
  const origin = proposal.origin
  // Once read, the details have their own proposal in the chat; no second AI call.
  const detailsRead = useOwlStore((s) =>
    s.messages.some(
      (m) =>
        m.type === 'proposal' &&
        m.proposal.syllabus !== undefined &&
        m.proposal.origin?.url === origin?.url,
    ),
  )
  if (!proposal.program || proposal.savedCount === null || !origin || year === null || detailsRead)
    return null

  const read = async () => {
    setBusy(true)
    setError(null)
    try {
      const got = await documentFromLink(origin.url)
      const result = await owl.giveDocument(got.input, 'syllabus', null, origin)
      if (!result.ok) setError(t(`owl.error.${result.code}`))
      else if (result.proposalId) navigate(`/chat/import/${result.proposalId}`)
      else setFound(result.found)
    } catch (err) {
      setError(t(`owl.error.${err instanceof AiCallError ? err.code : 'failed'}`))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-card surface p-4">
      <div className="flex items-center gap-3">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] leading-snug font-semibold">
            {t('academic.programDetails.title', { n: year })}
          </span>
          <span className="text-[13px] leading-[1.4] text-ink-secondary">
            {t('academic.programDetails.sub')}
          </span>
        </span>
        <button
          type="button"
          disabled={busy || found !== null}
          onClick={() => void read()}
          className="flex h-11 shrink-0 items-center rounded-full bg-canvas px-3.5 text-[13px] font-semibold text-brand disabled:opacity-50"
        >
          {busy
            ? t('academic.found.importing')
            : found !== null
              ? t('academic.found.nothing')
              : t('academic.found.import')}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
