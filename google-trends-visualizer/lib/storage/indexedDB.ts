import { TrendsData } from '../../types'
import { openDB, DBSchema, IDBPDatabase } from 'idb'

type TrendsDataWithSync = TrendsData & {
  syncState?: {
    lastSynced: number
    status: 'synced' | 'pending' | 'error'
  }
}

interface TrendsDB extends DBSchema {
  'trends_data': {
    key: string
    value: TrendsDataWithSync
    indexes: { [key: string]: IDBValidKey }
  }
}

export class IndexedDBService {
  private readonly DB_NAME = 'trends_visualizer'
  private readonly DB_VERSION = 1
  private readonly STORE_NAME = 'trends_data'
  private db: Promise<IDBPDatabase<TrendsDB>> | null = null

  private async getDB(): Promise<IDBPDatabase<TrendsDB>> {
    if (!this.db) {
      this.db = openDB<TrendsDB>(this.DB_NAME, this.DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('trends_data')) {
            const store = db.createObjectStore('trends_data', {
              keyPath: 'targetKeyword'
            })
            store.createIndex('by-reviewed', 'reviewed')
            store.createIndex('by-timestamp', 'timestamp')
          }
        }
      })
    }
    return this.db
  }

  // 基础数据操作
  async upsertData(data: TrendsData[]) {
    const db = await this.getDB()
    const tx = db.transaction(this.STORE_NAME, 'readwrite')
    const store = tx.objectStore(this.STORE_NAME)

    for (const item of data) {
      await store.put({
        ...item,
        syncState: {
          lastSynced: Date.now(),
          status: 'pending'
        }
      })
    }

    await tx.done
  }

  async getData(options: {
    reviewed?: boolean
    limit?: number
    offset?: number
    searchTerm?: string
  }): Promise<TrendsDataWithSync[]> {
    const db = await this.getDB()
    const tx = db.transaction(this.STORE_NAME, 'readonly')
    const store = tx.objectStore(this.STORE_NAME)
    let data = await store.getAll()

    // 过滤
    if (typeof options.reviewed === 'boolean') {
      data = data.filter(item => item.reviewed === options.reviewed)
    }

    if (options.searchTerm) {
      const term = options.searchTerm.toLowerCase()
      data = data.filter(item => 
        item.targetKeyword.toLowerCase().includes(term)
      )
    }

    // 分页
    if (options.offset || options.limit) {
      const start = options.offset || 0
      const end = options.limit ? start + options.limit : undefined
      data = data.slice(start, end)
    }

    return data
  }

  async updateReviewStatus(keywords: string[], reviewed: boolean) {
    const db = await this.getDB()
    const tx = db.transaction(this.STORE_NAME, 'readwrite')
    const store = tx.objectStore(this.STORE_NAME)

    for (const keyword of keywords) {
      const item = await store.get(keyword)
      if (item) {
        await store.put({
          ...item,
          reviewed,
          syncState: {
            lastSynced: Date.now(),
            status: 'pending'
          }
        })
      }
    }

    await tx.done
  }

  async deleteReviewedData() {
    const db = await this.getDB()
    const tx = db.transaction(this.STORE_NAME, 'readwrite')
    const store = tx.objectStore(this.STORE_NAME)
    const index = store.index('by-reviewed')

    let cursor = await index.openCursor(IDBKeyRange.only(true))
    
    while (cursor) {
      await cursor.delete()
      cursor = await cursor.continue()
    }

    await tx.done
  }

  // 同步相关
  async getPendingSyncs(): Promise<TrendsDataWithSync[]> {
    const db = await this.getDB()
    const tx = db.transaction(this.STORE_NAME, 'readonly')
    const store = tx.objectStore(this.STORE_NAME)
    const data = await store.getAll()
    return data.filter(item => item.syncState?.status === 'pending')
  }

  async markAsSynced(keywords: string[]) {
    const db = await this.getDB()
    const tx = db.transaction(this.STORE_NAME, 'readwrite')
    const store = tx.objectStore(this.STORE_NAME)

    for (const keyword of keywords) {
      const item = await store.get(keyword)
      if (item) {
        await store.put({
          ...item,
          syncState: {
            lastSynced: Date.now(),
            status: 'synced'
          }
        })
      }
    }

    await tx.done
  }

  async getLastSynced(): Promise<string | null> {
    const db = await this.getDB()
    const tx = db.transaction(this.STORE_NAME, 'readonly')
    const store = tx.objectStore(this.STORE_NAME)
    
    // 获取所有数据并找到最新的同步时间
    const data = await store.getAll()
    if (data.length === 0) return null
    
    const lastSynced = data.reduce((latest: number | null, item: TrendsDataWithSync) => {
      const syncTime = item.syncState?.lastSynced
      return syncTime && (!latest || syncTime > latest) ? syncTime : latest
    }, null)
    
    return lastSynced ? new Date(lastSynced).toISOString() : null
  }

  async clear() {
    const db = await this.getDB()
    await db.clear(this.STORE_NAME)
  }
}

export const indexedDBService = new IndexedDBService() 