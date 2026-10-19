import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { CheckIcon, PlusIcon } from '@/components/icons'
import { fieldInput } from '@/features/subjects/fields'
import { cn } from '@/lib/utils'
import { validationKey } from '@/lib/validation'
import { useSetUnitTopic } from './api'
import type { TopicWithUnits } from './model'
import { topicNameSchema } from './schemas'

/** Toggle the subject's topics on a unit, or create a new one. Manual links are `user`. */
export function TopicsSheet({
  open,
  onOpenChange,
  subjectId,
  unitId,
  topics,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  subjectId: string
  unitId: string
  topics: TopicWithUnits[]
}) {
  const { t } = useTranslation()
  const setTopic = useSetUnitTopic(subjectId)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = () => {
    const parsed = topicNameSchema.safeParse(name)
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? null)
    const existing = topics.find((x) => x.name.toLowerCase() === parsed.data.toLowerCase())
    setTopic.mutate({
      unitId,
      on: true,
      topic: existing
        ? { id: existing.id, name: existing.name, isNew: false }
        : { id: crypto.randomUUID(), name: parsed.data, isNew: true },
    })
    setName('')
    setError(null)
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('units.topics.title')}
      subtitle={t('units.topics.body')}
    >
      {topics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {topics.map((topic) => {
            const on = topic.unit_topics.some((l) => l.unit_id === unitId)
            return (
              <button
                key={topic.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() =>
                  setTopic.mutate({
                    unitId,
                    on: !on,
                    topic: { id: topic.id, name: topic.name, isNew: false },
                  })
                }
                className={cn(
                  'flex h-[38px] items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold',
                  on ? 'bg-brand text-white' : 'bg-canvas text-ink',
                )}
              >
                {on && <CheckIcon size={14} />}
                {topic.name}
              </button>
            )
          })}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
        className="flex gap-2"
      >
        <input
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('units.topics.newPlaceholder')}
          aria-label={t('units.topics.new')}
          aria-invalid={Boolean(error)}
          className={cn(fieldInput, 'min-w-0 flex-1')}
        />
        <button
          type="submit"
          aria-label={t('units.topics.add')}
          className="flex size-[54px] shrink-0 items-center justify-center rounded-input bg-brand text-white"
        >
          <PlusIcon size={20} />
        </button>
      </form>
      {error && (
        <span role="alert" className="text-sm text-danger">
          {t(validationKey(error))}
        </span>
      )}
    </BottomSheet>
  )
}
