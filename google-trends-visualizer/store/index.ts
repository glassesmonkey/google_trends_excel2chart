import { create } from 'zustand'
import { TrendsData, UploadState } from '../types'
import { googleDriveService } from '../lib/googleDrive'

interface Store {
  trendsData: TrendsData[]
  uploadState: UploadState
  isAuthenticated: boolean
  setTrendsData: (data: TrendsData[]) => void
  addTrendsData: (data: TrendsData) => Promise<void>
  setUploadState: (state: Partial<UploadState>) => void
  setAuthenticated: (state: boolean) => void
  syncWithDrive: () => Promise<void>
  loadFromDrive: () => Promise<void>
  updateTrendsData: (ids: string[], updates: Partial<TrendsData>) => Promise<void>
}

export const useStore = create<Store>((set, get) => ({
  trendsData: [],
  uploadState: {
    isUploading: false,
    progress: 0,
  },
  isAuthenticated: false,

  setTrendsData: (data) => set({ trendsData: data }),
  
  addTrendsData: async (data) => {
    const newData = [...get().trendsData, data]
    set({ trendsData: newData })
    
    // 同步到 Google Drive
    if (get().isAuthenticated) {
      try {
        await googleDriveService.saveData(newData)
      } catch (error) {
        console.error('同步到 Google Drive 失败:', error)
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
      await googleDriveService.saveData(get().trendsData)
    } catch (error) {
      console.error('同步到 Google Drive 失败:', error)
    }
  },

  loadFromDrive: async () => {
    if (!get().isAuthenticated) return
    try {
      const data = await googleDriveService.loadData()
      set({ trendsData: data })
    } catch (error) {
      console.error('从 Google Drive 加载失败:', error)
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
    
    // 同步到 Google Drive
    if (get().isAuthenticated) {
      try {
        await googleDriveService.saveData(newData)
      } catch (error) {
        console.error('同步到 Google Drive 失败:', error)
      }
    }
  }
})) 