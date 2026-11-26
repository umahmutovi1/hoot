import { readPages } from '@/lib/readPages'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { cardsToCsv, cardsToQuizlet } from '@/lib/cards/anki'
import { supabase } from '@/lib/supabase'

export function useCardCount() {
  const userId = useAuth().session?.user.id
  return useQuery({
    queryKey: ['cards-count', userId] as const,
    enabled: Boolean(userId),
    queryFn: async () => {
      const { count, error } = await supabase
        .from('cards')
        .select('id', { count: 'exact', head: true })
      if (error) throw error
      return count ?? 0
    },
  })
}

async function allCards() {
  // Every card, not only the first 1000 the API returns in one answer.
  const data = await readPages((from, to) =>
    supabase
      .from('cards')
      .select('front, back, created_at, units(label, sources(subjects(name)))')
      .order('created_at')
      .order('id')
      .range(from, to),
  )
  return data.map((c) => {
    const unit = c.units as { label: string | null; sources: unknown } | null
    const subject = (unit?.sources as { subjects?: { name?: string } } | null)?.subjects?.name
    return {
      front: c.front,
      back: c.back,
      tags: [subject, unit?.label].filter((x): x is string => Boolean(x)),
    }
  })
}

/** Every card as an Anki CSV, tagged with its subject and unit label. */
export async function cardsCsv(): Promise<string> {
  return cardsToCsv(await allCards())
}

/** Every card as Quizlet import text (term ⇥ definition). */
export async function cardsQuizlet(): Promise<string> {
  return cardsToQuizlet(await allCards())
}
