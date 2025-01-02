import { create } from 'zustand'
import { TrendsData, UploadState } from '../types'
import { supabaseService } from '../lib/storage/supabase'
import { indexedDBService } from '../lib/storage/indexedDB'
import { syncManager } from '../lib/storage/syncManager'

interface Store {
  trendsData: TrendsData[]
  uploadState: UploadState
  showReviewed: boolean
  isLoading: boolean
  loadingText: string
  setTrendsData: (data: TrendsData[]) => void
  addTrendsData: (data: TrendsData[]) => Promise<void>
  setUploadState: (state: Partial<UploadState>) => void
  loadData: () => Promise<void>
  updateReviewStatus: (ids: string[], reviewed: boolean) => Promise<void>
  setShowReviewed: (show: boolean) => Promise<void>
  clearReviewedData: () => Promise<void>
  setLoading: (isLoading: boolean, text?: string) => void
}

export const useStore = create<Store>((set, get) => ({
  trendsData: [],
  uploadState: {
    isUploading: false,
    progress: 0,
  },
  showReviewed: false,
  isLoading: false,
  loadingText: '',

  setLoading: (isLoading: boolean, text: string = '') => 
    set({ isLoading, loadingText: text }),

  setShowReviewed: async (show) => {
    set({ showReviewed: show })
    try {
      set({ isLoading: true, loadingText: '正在加载数据...' })
      const data = await indexedDBService.getData({ reviewed: show })
      set({ trendsData: data })
    } finally {
      set({ isLoading: false, loadingText: '' })
    }
  },

  setTrendsData: (data) => set({ trendsData: data }),
  
  addTrendsData: async (dataArray) => {
    try {
      set({ isLoading: true, loadingText: '正在处理数据...' })
      
      // 批量验证数据
      const validData = dataArray.filter(data => {
        const monthlyAverage = Math.round(
          data.comparisonData.reduce((sum, point) => sum + point.monthlyVolume, 0) / 
          data.comparisonData.length
        )
        
        if (data.lastWeekVolume === 0 && monthlyAverage === 0) {
          console.log(`跳过无效数据: ${data.fileName} (关键词: ${data.targetKeyword})，月均和近七日均为0`)
          return false
        }
        return true
      })

      if (validData.length === 0) {
        console.log('没有有效数据需要保存')
        return
      }

      set({ loadingText: `正在保存 ${validData.length} 条数据...` })
      
      // 批量保存数据
      await syncManager.uploadNewData(validData)
      
      // 更新显示的数据
      const allData = await indexedDBService.getData({ reviewed: get().showReviewed })
      set({ trendsData: allData })
      
      console.log(`成功保存 ${validData.length} 条数据`)
    } finally {
      set({ isLoading: false, loadingText: '' })
    }
  },
  
  setUploadState: (state) =>
    set((prev) => ({
      uploadState: { ...prev.uploadState, ...state }
    })),

  loadData: async () => {
    try {
      set({ isLoading: true, loadingText: '正在加载数据...' })
      await syncManager.initializeData()
      const data = await indexedDBService.getData({ reviewed: get().showReviewed })
      set({ trendsData: data })
      // 启动自动同步
      syncManager.startAutoSync()
    } finally {
      set({ isLoading: false, loadingText: '' })
    }
  },

  updateReviewStatus: async (ids: string[], reviewed: boolean) => {
    try {
      set({ isLoading: true, loadingText: '正在更新状态...' })
      console.log('开始更新状态:', { ids, reviewed })
      
      // 先获取对应的 targetKeyword
      const currentData = get().trendsData
      const keywords = ids.map(id => {
        const item = currentData.find(d => d.id === id)
        if (!item) {
          console.warn(`未找到ID为 ${id} 的数据`)
          return null
        }
        return item.targetKeyword
      }).filter(Boolean) as string[]
      
      if (keywords.length === 0) {
        console.warn('没有找到有效的关键词')
        return
      }
      
      console.log('找到对应的关键词:', keywords)
      await syncManager.updateReviewStatus(keywords, reviewed)
      
      // 重新加载数据以确保状态同步
      const data = await indexedDBService.getData({ reviewed: get().showReviewed })
      console.log('更新后的数据:', data)
      
      set({ trendsData: data })
    } catch (error) {
      console.error('更新状态失败:', error)
      throw error
    } finally {
      set({ isLoading: false, loadingText: '' })
    }
  },

  clearReviewedData: async () => {
    try {
      set({ isLoading: true, loadingText: '正在清除已研究数据...' })
      await syncManager.deleteReviewedData()
      const data = await indexedDBService.getData({ reviewed: get().showReviewed })
      set({ trendsData: data })
    } finally {
      set({ isLoading: false, loadingText: '' })
    }
  }
})) 