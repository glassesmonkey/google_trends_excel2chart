import { create } from 'zustand'
import { TrendsData, UploadState } from '../types'
import { googleDriveService } from '../lib/googleDrive'

interface Store {
  trendsData: TrendsData[]
  uploadState: UploadState
  isAuthenticated: boolean
  showReviewed: boolean
  isLoading: boolean
  loadingText: string
  setTrendsData: (data: TrendsData[]) => void
  addTrendsData: (data: TrendsData) => Promise<void>
  setUploadState: (state: Partial<UploadState>) => void
  setAuthenticated: (state: boolean) => void
  syncWithDrive: () => Promise<void>
  loadFromDrive: () => Promise<void>
  updateTrendsData: (ids: string[], updates: Partial<TrendsData>) => Promise<void>
  setShowReviewed: (show: boolean) => Promise<void>
  clearReviewedData: () => Promise<void>
  setLoading: (isLoading: boolean, text?: string) => void
  logout: () => void
}

export const useStore = create<Store>((set, get) => ({
  trendsData: [],
  uploadState: {
    isUploading: false,
    progress: 0,
  },
  isAuthenticated: false,
  showReviewed: false,
  isLoading: false,
  loadingText: '',

  setLoading: (isLoading: boolean, text: string = '') => 
    set({ isLoading, loadingText: text }),

  setShowReviewed: async (show) => {
    set({ showReviewed: show })
    if (get().isAuthenticated) {
      try {
        set({ isLoading: true, loadingText: '正在加载数据...' })
        const data = await googleDriveService.loadAllData(show)
        set({ trendsData: data })
      } finally {
        set({ isLoading: false, loadingText: '' })
      }
    }
  },

  setTrendsData: (data) => set({ trendsData: data }),
  
  addTrendsData: async (data) => {
    const newData = [...get().trendsData, data]
    set({ trendsData: newData })
    
    // 同步到 Google Drive
    if (get().isAuthenticated) {
      try {
        set({ isLoading: true, loadingText: '正在保存数据...' })
        await googleDriveService.saveData(newData)
      } finally {
        set({ isLoading: false, loadingText: '' })
      }
    }
  },
  
  setUploadState: (state) =>
    set((prev) => ({
      uploadState: { ...prev.uploadState, ...state }
    })),

  setAuthenticated: (state) => set({ isAuthenticated: state }),

  syncWithDrive: async () => {
    if (!get().isAuthenticated) return
    try {
      set({ isLoading: true, loadingText: '正在同步数据...' })
      await googleDriveService.saveData(get().trendsData)
    } finally {
      set({ isLoading: false, loadingText: '' })
    }
  },

  loadFromDrive: async () => {
    if (!get().isAuthenticated) return
    try {
      set({ isLoading: true, loadingText: '正在从云端加载数据...' })
      const data = await googleDriveService.loadAllData(get().showReviewed)
      set({ trendsData: data })
    } finally {
      set({ isLoading: false, loadingText: '' })
    }
  },

  updateTrendsData: async (ids: string[], updates: Partial<TrendsData>) => {
    const newData = get().trendsData.map(item => {
      if (ids.includes(item.id)) {
        return { ...item, ...updates }
      }
      return item
    })
    
    set({ trendsData: newData })
    
    if (get().isAuthenticated) {
      try {
        set({ isLoading: true, loadingText: '正在更新数据状态...' })
        await googleDriveService.saveDataWithReviewedStatus(newData)
      } finally {
        set({ isLoading: false, loadingText: '' })
      }
    }
  },

  clearReviewedData: async () => {
    if (!get().isAuthenticated) return
    
    try {
      set({ isLoading: true, loadingText: '正在清除已研究数据...' })
      const success = await googleDriveService.deleteReviewedData()
      if (success) {
        // 重新加载数据
        const data = await googleDriveService.loadAllData(get().showReviewed)
        set({ trendsData: data })
      }
    } finally {
      set({ isLoading: false, loadingText: '' })
    }
  },

  logout: () => {
    googleDriveService.clearToken()
    set({ 
      isAuthenticated: false,
      trendsData: [],
      showReviewed: false
    })
  }
})) 