import { useState, type ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Switch } from '@/components/Switch'
import { useSubjects } from '@/features/subjects/api'
import {
  assignSyllabusSubject,
  type GradingProposal,
  type SyllabusProposal,
} from '@/lib/import/syllabus'
import { cn } from '@/lib/utils'
import { syllabusExisting } from './actions'
import { StatusChip } from './ImportCard'

const sectionTitle = 'px-1 pt-1 text-[13px] font-semibold text-ink-muted uppercase'
const chip = 'flex h-[38px] shrink-0 items-center rounded-full px-3.5 text-[13px] font-semibold'

/**
 * "Pregled uvoza · Plan i program" (PlanIProgram.dc.html 3–4): one subject at a time, with
 * literature → sources, topics and grading → exams. New subjects are offered; what the user
 * entered stays.
 */
export function SyllabusReview({
  items,
  saved,
  onChange,
  onPickElective,
}: {
  items: SyllabusProposal[]
  saved: boolean
  onChange: (key: string, update: (p: SyllabusProposal) => SyllabusProposal) => void
  /** "Koji slušaš?": adds this option of its elective slot, not the others. */
  onPickElective: (key: string) => void
}) {
  const { t } = useTranslation()
  const subjects = (useSubjects().data ?? []).filter((s) => !s.archived)
  const [open, setOpen] = useState(items[0]?.key ?? '')
  const [matching, setMatching] = useState(false)
  const item = items.find((x) => x.key === open) ?? items[0]
  if (!item) return null
  const nameOf = (p: SyllabusProposal) =>
    subjects.find((s) => s.id === p.subjectId)?.name ?? p.subjectName
  const set = (update: (p: SyllabusProposal) => SyllabusProposal) => onChange(item.key, update)
  const toggle = <K extends 'literature' | 'topics' | 'grading'>(
    list: K,
    key: string,
    on: boolean,
  ) =>
    set((p) => ({
      ...p,
      [list]: (p[list] as { key: string }[]).map((x) =>
        x.key === key ? { ...x, include: on } : x,
      ),
    }))
  const disabled = saved || (!item.subjectId && !item.addSubject)
  // An elective slot is one tab: its picked option, else the slot's name.
  const tabs: { key: string; label: string; group: string | null }[] = []
  for (const x of items) {
    const group = !x.subjectId ? x.electiveGroup : null
    if (!group) {
      tabs.push({ key: x.key, label: x.subjectId ? nameOf(x) : `+ ${x.subjectName}`, group: null })
      continue
    }
    if (tabs.some((tab) => tab.group === group)) continue
    const picked = items.find((o) => o.electiveGroup === group && !o.subjectId && o.addSubject)
    tabs.push({
      key: (picked ?? x).key,
      label: picked ? `+ ${picked.subjectName}` : group,
      group,
    })
  }

  const match = async (subjectId: string) => {
    const subject = subjects.find((s) => s.id === subjectId)
    if (!subject) return
    const existing = await syllabusExisting({ subjects })
    set((p) => assignSyllabusSubject(p, { id: subject.id, name: subject.name }, existing))
    setMatching(false)
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className={sectionTitle}>{t('owl.syllabus.section')}</h2>
      {tabs.length > 1 && (
        <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1" role="tablist">
          {tabs.map((x) => {
            const on = x.group
              ? item.electiveGroup === x.group && !item.subjectId
              : x.key === item.key
            return (
              <button
                key={x.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setOpen(x.key)
                  setMatching(false)
                }}
                className={cn(chip, on ? 'bg-ink text-white' : 'bg-white/50')}
              >
                {x.label}
              </button>
            )
          })}
        </div>
      )}
      <h3 className="px-1 text-[22px] leading-tight font-bold">{nameOf(item)}</h3>

      {!item.subjectId && item.electiveGroup && (
        <div className="flex flex-col gap-3 rounded-card glass p-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold">
              {t('owl.syllabus.electiveTitle', { group: item.electiveGroup })}
            </span>
            <span className="text-[13px] leading-[1.4] text-ink-muted">
              {t('owl.syllabus.electiveSub')}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5" role="radiogroup">
            {items
              .filter((x) => x.electiveGroup === item.electiveGroup && !x.subjectId)
              .map((x) => (
                <button
                  key={x.key}
                  type="button"
                  role="radio"
                  aria-checked={x.addSubject}
                  disabled={saved}
                  onClick={() => {
                    onPickElective(x.key)
                    setOpen(x.key)
                  }}
                  className={cn(
                    chip,
                    'h-auto min-h-[38px] py-1.5 text-left',
                    x.addSubject ? 'bg-ink text-white' : 'bg-white/50',
                  )}
                >
                  {x.subjectName}
                </button>
              ))}
          </div>
        </div>
      )}

      {!item.subjectId && !item.electiveGroup && (
        <div className="flex flex-col gap-3 rounded-card glass p-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold">{t('owl.syllabus.addTitle')}</span>
            <span className="text-[13px] leading-[1.4] text-ink-muted">
              {t('owl.syllabus.addSub')}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5" role="radiogroup">
            {(['add', 'match', 'skip'] as const).map((choice) => {
              const on =
                choice === 'match' ? matching : !matching && (choice === 'add') === item.addSubject
              return (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={saved}
                  onClick={() => {
                    if (choice === 'match') return setMatching(true)
                    setMatching(false)
                    set((p) => ({ ...p, addSubject: choice === 'add' }))
                  }}
                  className={cn(chip, on ? 'bg-ink text-white' : 'bg-white/50')}
                >
                  {t(`owl.syllabus.${choice}`)}
                </button>
              )
            })}
          </div>
          {matching && (
            <div className="flex flex-wrap gap-1.5">
              {subjects.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => void match(s.id)}
                  className={cn(chip, 'bg-white/50')}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {item.literature.length > 0 && (
        <List title={t('owl.syllabus.literature')}>
          {item.literature.map((l) => (
            <Row
              key={l.key}
              title={l.authors ? `${l.authors} — ${l.title}` : l.title}
              sub={t(l.required ? 'owl.syllabus.required' : 'owl.syllabus.extra')}
              status={l.status === 'unchanged' ? 'unchanged' : l.include ? 'new' : 'skipped'}
              statusLabel={l.status === 'unchanged' ? t('owl.syllabus.have') : undefined}
              include={l.include}
              disabled={disabled || l.status === 'unchanged'}
              onInclude={(on) => toggle('literature', l.key, on)}
            />
          ))}
        </List>
      )}

      {item.topics.length > 0 && (
        <List title={t('owl.syllabus.topicsTitle')}>
          {item.topics.map((x) => (
            <Row
              key={x.key}
              title={x.week ? `${t('owl.syllabus.week', { n: x.week })} · ${x.name}` : x.name}
              status={x.status === 'unchanged' ? 'unchanged' : x.include ? 'new' : 'skipped'}
              include={x.include}
              disabled={disabled || x.status === 'unchanged'}
              onInclude={(on) => toggle('topics', x.key, on)}
            />
          ))}
        </List>
      )}

      {item.chapters && (
        <List title={t('owl.syllabus.chaptersTitle')}>
          <Row
            title={t('owl.syllabus.chaptersRow', {
              count: item.chapters.parts.length,
              chapters: new Set(item.chapters.parts.map((x) => x.chapter)).size,
            })}
            sub={t(
              item.chapters.replacesRough
                ? 'owl.syllabus.chaptersReplaces'
                : 'owl.syllabus.chaptersSub',
            )}
            status={item.chapters.include ? 'new' : 'skipped'}
            include={item.chapters.include}
            disabled={disabled}
            onInclude={(on) =>
              set((p) => (p.chapters ? { ...p, chapters: { ...p.chapters, include: on } } : p))
            }
          />
        </List>
      )}

      {item.grading.length > 0 && (
        <List title={t('owl.syllabus.grading')}>
          {item.grading.map((g) => (
            <Row
              key={g.key}
              title={gradeTitle(t, g)}
              sub={gradeSub(t, g)}
              status={
                !g.examKind || g.status === 'unchanged'
                  ? 'unchanged'
                  : g.include
                    ? g.status
                    : 'skipped'
              }
              statusLabel={g.manual ? t('owl.syllabus.manual') : undefined}
              include={g.include}
              disabled={disabled || !g.examKind || g.status === 'unchanged'}
              onInclude={(on) => toggle('grading', g.key, on)}
            />
          ))}
          {item.pointsTotal && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="font-semibold">
                {t('owl.syllabus.total', { points: item.pointsTotal.value })}
              </span>
              {item.pointsTotal.previous !== null &&
                item.pointsTotal.previous !== item.pointsTotal.value && (
                  <span className="text-xs text-ink-muted">
                    {t('owl.syllabus.totalWas', { points: item.pointsTotal.previous })}
                  </span>
                )}
            </div>
          )}
        </List>
      )}
      <p className="px-1 text-xs leading-[1.4] text-ink-muted">{t('owl.syllabus.hint')}</p>
    </section>
  )
}

function gradeTitle(t: TFunction, g: GradingProposal) {
  const parts = [g.title]
  if (g.points !== null) parts.push(t('owl.syllabus.points', { points: g.points }))
  if (g.passPoints !== null) parts.push(t('owl.syllabus.pass', { points: g.passPoints }))
  return parts.join(' · ')
}

function gradeSub(t: TFunction, g: GradingProposal) {
  if (!g.examKind) return t('owl.syllabus.onlyTotal')
  if (g.manual) return t('owl.syllabus.manualSub', { points: g.previousPoints })
  if (g.status === 'changed' && g.previousPoints === null) return undefined
  if (g.status === 'new') return t('owl.syllabus.newExamSub')
  return undefined
}

function List({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h4 className="px-1 pt-1 text-[13px] font-semibold text-ink-muted uppercase">{title}</h4>
      <div className="flex flex-col divide-y divide-hairline rounded-card glass">{children}</div>
    </>
  )
}

function Row(props: {
  title: string
  sub?: string
  status: Parameters<typeof StatusChip>[0]['status']
  statusLabel?: string
  include: boolean
  disabled: boolean
  onInclude: (on: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[15px] leading-snug">{props.title}</span>
        {props.sub && <span className="text-xs text-ink-muted">{props.sub}</span>}
        <span className="self-start">
          {props.statusLabel ? (
            <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] font-semibold text-ink-secondary">
              {props.statusLabel}
            </span>
          ) : (
            <StatusChip status={props.status} />
          )}
        </span>
      </div>
      <Switch
        hideLabel
        checked={props.include}
        disabled={props.disabled}
        onChange={props.onInclude}
        label={t('owl.reviewPage.include')}
      />
    </div>
  )
}
