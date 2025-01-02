import { supabaseService } from './supabase'
import { indexedDBService } from './indexedDB'
import { TrendsData } from '../../types'

export class SyncManager {
  private syncInProgress = false
  private syncInterval: NodeJS.Timeout | null = null

  // 启动自动同步
  startAutoSync(intervalMs: number = 60000) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }

    this.syncInterval = setInterval(() => {
      this.sync().catch(console.error)
    }, intervalMs)
  }

  // 停止自动同步
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  // 手动同步
  async sync() {
    if (this.syncInProgress) {
      console.log('同步正在进行中...')
      return
    }

    try {
      this.syncInProgress = true
      console.log('开始同步...')

      // 1. 获取本地待同步数据
      const pendingData = await indexedDBService.getPendingSyncs()
      if (pendingData.length > 0) {
        console.log(`发现 ${pendingData.length} 条待同步数据`)
        
        // 2. 上传到 Supabase
        const result = await supabaseService.batchUpsert(pendingData)
        console.log('数据上传结果:', result)
        
        // 3. 标记为已同步
        const syncedKeywords = pendingData.map(item => item.targetKeyword)
        await indexedDBService.markAsSynced(syncedKeywords)
        console.log(`已标记 ${syncedKeywords.length} 条数据为已同步`)

        // 4. 同步 reviewed 状态
        const reviewedKeywords = pendingData
          .filter(item => item.reviewed)
          .map(item => item.targetKeyword)
        
        if (reviewedKeywords.length > 0) {
          console.log(`同步 ${reviewedKeywords.length} 条已研究状态`)
          const updateResult = await supabaseService.updateReviewStatus(reviewedKeywords, true)
          console.log('状态更新结果:', updateResult)
        }
      }

      // 5. 获取远程更新
      const lastSynced = await indexedDBService.getLastSynced()
      if (lastSynced) {
        const remoteUpdates = await supabaseService.getUpdatedSince(lastSynced)
        if (remoteUpdates?.length > 0) {
          console.log(`发现 ${remoteUpdates.length} 条远程更新`)
          await indexedDBService.upsertData(remoteUpdates)
          console.log('远程更新已保存到本地')
        }
      }

      console.log('同步完成')
    } catch (error) {
      console.error('同步失败:', error)
      throw error
    } finally {
      this.syncInProgress = false
    }
  }

  // 初始化数据
  async initializeData(options: { reviewed?: boolean } = {}) {
    try {
      console.log('开始初始化数据...')
      
      // 1. 清空本地数据
      await indexedDBService.clear()
      
      // 2. 获取远程数据（根据 reviewed 状态筛选）
      const remoteData = await supabaseService.getData(options)
      
      // 3. 保存到本地
      if (remoteData.length > 0) {
        console.log(`加载 ${remoteData.length} 条远程数据`)
        await indexedDBService.upsertData(remoteData)
      }
      
      console.log('数据初始化完成')
    } catch (error) {
      console.error('数据初始化失败:', error)
      throw error
    }
  }

  // 上传新数据
  async uploadNewData(data: TrendsData[]) {
    try {
      console.log(`准备上传 ${data.length} 条新数据`)
      
      // 1. 保存到本地
      await indexedDBService.upsertData(data)
      
      // 2. 立即同步到远程
      await this.sync()
      
      console.log('新数据上传完成')
    } catch (error) {
      console.error('新数据上传失败:', error)
      throw error
    }
  }

  // 更新研究状态
  async updateReviewStatus(keywords: string[], reviewed: boolean) {
    try {
      console.log(`更新 ${keywords.length} 条数据的研究状态`)
      
      // 1. 更新本地状态
      await indexedDBService.updateReviewStatus(keywords, reviewed)
      
      // 2. 立即同步到远程
      await this.sync()
      
      console.log('状态更新完成')
    } catch (error) {
      console.error('状态更新失败:', error)
      throw error
    }
  }

  // 删除已研究数据
  async deleteReviewedData() {
    try {
      console.log('开始删除已研究数据')
      
      // 1. 删除本地数据
      await indexedDBService.deleteReviewedData()
      
      // 2. 删除远程数据
      await supabaseService.deleteReviewedData()
      
      console.log('已研究数据删除完成')
    } catch (error) {
      console.error('删除已研究数据失败:', error)
      throw error
    }
  }
}

export const syncManager = new SyncManager() 