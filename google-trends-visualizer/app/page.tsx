'use client'

import { useEffect, useState, useMemo } from 'react'
import { useStore } from '../store'
import FileUploader from '../components/FileUploader'
import TrendsChart from '../components/TrendsChart'
import { useInView } from 'react-intersection-observer'
import { googleDriveService } from '../lib/googleDrive'
import { TrendsData } from '../types'
import { calculateFreshnessScore } from '../utils/calculations'

const ITEMS_PER_PAGE = 12

type SortField = 'monthlyVolume' | 'freshness' | 'timestamp'
type SortOrder = 'asc' | 'desc'

export default function Home() {
  const { 
    trendsData, 
    isAuthenticated, 
    setAuthenticated, 
    loadFromDrive 
  } = useStore()
  
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('timestamp')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  
  const { ref, inView } = useInView({
    threshold: 0,
    delay: 100
  })

  // 处理排序和搜索
  const filteredAndSortedData = useMemo(() => {
    let result = [...trendsData]

    // 搜索过滤
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(data => 
        data.targetKeyword.toLowerCase().includes(term)
      )
    }

    // 排序
    result.sort((a, b) => {
      let compareValue: number = 0

      switch (sortField) {
        case 'monthlyVolume':
          const aVolume = a.comparisonData.reduce((sum, p) => sum + p.monthlyVolume, 0) / a.comparisonData.length
          const bVolume = b.comparisonData.reduce((sum, p) => sum + p.monthlyVolume, 0) / b.comparisonData.length
          compareValue = aVolume - bVolume
          break
        
        case 'freshness':
          const aFreshness = calculateFreshnessScore(a.comparisonData)
          const bFreshness = calculateFreshnessScore(b.comparisonData)
          compareValue = aFreshness - bFreshness
          break
        
        default: // timestamp
          compareValue = a.timestamp - b.timestamp
      }

      return sortOrder === 'desc' ? -compareValue : compareValue
    })

    return result
  }, [trendsData, searchTerm, sortField, sortOrder])

  // 处理 Google Drive 认证
  useEffect(() => {
    const initGoogleDrive = async () => {
      // 检查 URL 中是否有访问令牌
      const hash = window.location.hash
      if (hash) {
        const params = new URLSearchParams(hash.substring(1))
        const accessToken = params.get('access_token')
        const expiresIn = parseInt(params.get('expires_in') || '3600')
        
        if (accessToken) {
          try {
            console.log('Setting new token from URL')
            googleDriveService.setToken(accessToken, expiresIn)
            setAuthenticated(true)
            await loadFromDrive()
            // 清除 URL 中的令牌
            window.history.replaceState({}, '', window.location.pathname)
            return
          } catch (error) {
            console.error('Google Drive 认证失败:', error)
          }
        }
      }

      // 尝��恢复已保存的凭证
      console.log('Trying to restore token')
      if (googleDriveService.restoreToken()) {
        console.log('Token restored successfully')
        setAuthenticated(true)
        try {
          await loadFromDrive()
        } catch (error) {
          console.error('加载 Drive 数据失败:', error)
          // 如果加载失败，可能是 token 失效
          setAuthenticated(false)
        }
      } else {
        console.log('No valid token found')
        setAuthenticated(false)
      }
    }

    initGoogleDrive()
  }, [setAuthenticated, loadFromDrive])

  // 无限滚动
  useEffect(() => {
    if (inView && displayCount < trendsData.length) {
      setDisplayCount(prev => Math.min(prev + ITEMS_PER_PAGE, trendsData.length))
    }
  }, [inView, trendsData.length, displayCount])

  // 处理登录
  const handleLogin = () => {
    window.location.href = googleDriveService.getAuthUrl()
  }

  // 处理排序变更
  const handleSortChange = (field: SortField) => {
    if (field === sortField) {
      setSortOrder(order => order === 'desc' ? 'asc' : 'desc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  // 在处理 OAuth 回调的地方
  const handleOAuthCallback = (hash: string) => {
    const params = new URLSearchParams(hash.substring(1))
    const accessToken = params.get('access_token')
    const expiresIn = parseInt(params.get('expires_in') || '3600')
    
    if (accessToken) {
      googleDriveService.setToken(accessToken, expiresIn)
    }
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 font-[family-name:var(--font-geist-sans)]">
      <main className="max-w-[1920px] mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold">
            Google Trends Visualizer
          </h1>
          {!isAuthenticated && (
            <button
              onClick={handleLogin}
              className="px-4 py-2 bg-blue-500 text-white rounded-full
                      hover:bg-blue-600 transition-colors"
            >
              连接 Google Drive
            </button>
          )}
        </div>

        <section className="mb-6">
          <FileUploader />
        </section>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="搜索关键词..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleSortChange('monthlyVolume')}
              className={`px-4 py-2 rounded-lg border transition-colors ${
                sortField === 'monthlyVolume' ? 'bg-blue-500 text-white' : 'hover:bg-gray-50'
              }`}
            >
              按月均搜索量{sortField === 'monthlyVolume' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
            <button
              onClick={() => handleSortChange('freshness')}
              className={`px-4 py-2 rounded-lg border transition-colors ${
                sortField === 'freshness' ? 'bg-blue-500 text-white' : 'hover:bg-gray-50'
              }`}
            >
              按新鲜度{sortField === 'freshness' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
          </div>
        </div>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
          {filteredAndSortedData.slice(0, displayCount).map((data) => (
            <div key={data.id} className="bg-white rounded-lg shadow-sm p-3">
              <h2 className="text-sm font-medium mb-2 truncate">
                {data.targetKeyword}
              </h2>
              <TrendsChart data={data} />
            </div>
          ))}
        </section>

        {filteredAndSortedData.length > displayCount && (
          <div ref={ref} className="h-16 flex items-center justify-center mt-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
          </div>
        )}

        {filteredAndSortedData.length === 0 && (
          <div className="text-center text-gray-500 mt-6">
            {searchTerm ? '没有找到匹配的关键词' : '请上传 CSV 文件以查看趋势图表'}
          </div>
        )}
      </main>
    </div>
  )
}
