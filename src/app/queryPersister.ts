import Dexie, { type Table } from 'dexie'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'

/**
 * The query cache is kept in IndexedDB, so a screen opened offline after a closed tab still has
 * the subjects and sources it showed last time (starting a session needs them).
 */
class CacheDb extends Dexie {
  kv!: Table<{ key: string; value: string }, string>

  constructor() {
    super('hoot-cache')
    this.version(1).stores({ kv: 'key' })
  }
}

const db = new CacheDb()

export const queryPersister = createAsyncStoragePersister({
  key: 'hoot-query-cache',
  throttleTime: 2_000,
  storage: {
    getItem: async (key) => (await db.kv.get(key))?.value ?? null,
    setItem: async (key, value) => {
      await db.kv.put({ key, value })
    },
    removeItem: async (key) => {
      await db.kv.delete(key)
    },
  },
})
