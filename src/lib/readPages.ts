/** Read all pages of a bounded history query instead of silently accepting the API's row cap. */
export async function readPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += 1000) {
    const result = await fetchPage(from, from + 999)
    if (result.error) throw result.error
    const page = result.data ?? []
    rows.push(...page)
    if (page.length < 1000) return rows
  }
}
