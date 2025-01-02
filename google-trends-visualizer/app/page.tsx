'use client'

import { useEffect, useState, useMemo } from 'react'
import { useStore } from '../store'
import FileUploader from '../components/FileUploader'
import TrendsChart from '../components/TrendsChart'
import { useInView } from 'react-intersection-observer'
import { calculateFreshnessScore } from '../utils/calculations'

const ITEMS_PER_PAGE = 12

type SortField = 'monthlyVolume' | 'freshness' | 'lastWeekVolume' | 'timestamp'
type SortOrder = 'asc' | 'desc'

export default function Home() {
  const { 
    trendsData, 
    loadData,
    updateReviewStatus,
    showReviewed,
    setShowReviewed,
    clearReviewedData,
    isLoading,
    loadingText
  } = useStore()
  
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('timestamp')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  
  const { ref, inView } = useInView({
    threshold: 0,
    delay: 100
  })

  // 处理排序和搜索
  const filteredAndSortedData = useMemo(() => {
    let result = [...trendsData]

    // 索过滤
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
        
        case 'lastWeekVolume':
          compareValue = (a.lastWeekVolume || 0) - (b.lastWeekVolume || 0)
          break
        
        default: // timestamp
          compareValue = a.timestamp - b.timestamp
      }

      return sortOrder === 'desc' ? -compareValue : compareValue
    })

    return result
  }, [trendsData, searchTerm, sortField, sortOrder])

  console.log('filteredAndSortedData sample:', 
    filteredAndSortedData.slice(0, 1).map(d => ({
      id: d.id,
      keyword: d.targetKeyword,
      hasComparisonData: Boolean(d.comparisonData?.length)
    }))
  )

  // 处理认证
  useEffect(() => {
    loadData()
  }, [loadData])

  // 无限滚动
  useEffect(() => {
    if (inView && displayCount < trendsData.length) {
      setDisplayCount(prev => Math.min(prev + ITEMS_PER_PAGE, trendsData.length))
    }
  }, [inView, trendsData.length, displayCount])

  // 处理排序变更
  const handleSortChange = (field: SortField) => {
    if (field === sortField) {
      setSortOrder(order => order === 'desc' ? 'asc' : 'desc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  // 处理全选
  const handleSelectAll = () => {
    if (selectedIds.length === filteredAndSortedData.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredAndSortedData.map(d => d.id))
    }
  }
  
  // 处理单个选择
  const handleSelect = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id)
      }
      return [...prev, id]
    })
  }
  
  // 标记为已研究
  const handleMarkAsReviewed = async () => {
    if (selectedIds.length === 0) return
    await updateReviewStatus(selectedIds, true)
    setSelectedIds([])
  }

  // 添加清除处理函数
  const handleClearReviewed = async () => {
    if (confirm('确定要删除所有已研究的数据吗？此操作不可恢复。')) {
      await clearReviewedData()
    }
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 font-[family:var(--font-geist-sans)]">
      <main className="max-w-[1920px] mx-auto">
        {isLoading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
              <div className="text-lg font-medium">{loadingText}</div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold">
            Google Trends Visualizer
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowReviewed(!showReviewed)}
              className={`px-4 py-2 rounded-full border transition-colors ${
                showReviewed ? 'bg-green-500 text-white' : 'hover:bg-gray-50'
              }`}
            >
              {showReviewed ? '查看未研究' : '查看已研究'}
            </button>
            {showReviewed && (
              <button
                onClick={handleClearReviewed}
                className="px-4 py-2 bg-red-500 text-white rounded-full
                        hover:bg-red-600 transition-colors"
              >
                清除已研究
              </button>
            )}
          </div>
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
              按热度{sortField === 'freshness' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
            <button
              onClick={() => handleSortChange('lastWeekVolume')}
              className={`px-4 py-2 rounded-lg border transition-colors ${
                sortField === 'lastWeekVolume' ? 'bg-blue-500 text-white' : 'hover:bg-gray-50'
              }`}
            >
              按近7日均值{sortField === 'lastWeekVolume' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowReviewed(false)}
              className={`px-4 py-2 rounded-lg border transition-colors
                ${!showReviewed ? 'bg-blue-500 text-white' : 'hover:bg-gray-50'}`}
            >
              未研究数据
            </button>
            <button
              onClick={() => setShowReviewed(true)}
              className={`px-4 py-2 rounded-lg border transition-colors
                ${showReviewed ? 'bg-blue-500 text-white' : 'hover:bg-gray-50'}`}
            >
              所有数据
            </button>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedIds.length === filteredAndSortedData.length}
                onChange={handleSelectAll}
                className="w-4 h-4"
              />
              <span className="text-sm">全选</span>
            </label>
            
            <button
              onClick={handleMarkAsReviewed}
              disabled={selectedIds.length === 0}
              className={`px-4 py-2 rounded-lg border transition-colors
                ${selectedIds.length > 0 
                  ? 'bg-green-500 text-white hover:bg-green-600' 
                  : 'bg-gray-100 text-gray-400'}`}
            >
              标记为已研究 ({selectedIds.length})
            </button>
          </div>
        </div>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAndSortedData.slice(0, displayCount).map((data) => (
            <div 
              key={data.id} 
              className={`relative rounded-lg shadow-sm p-4
                ${data.reviewed 
                  ? 'bg-emerald-50 border border-emerald-200' 
                  : 'bg-white'}`}
            >
              <div className="absolute top-2 right-2">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(data.id)}
                  onChange={() => handleSelect(data.id)}
                  className="w-4 h-4"
                />
              </div>
              
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <h2 className="text-sm font-medium truncate">
                    {data.targetKeyword}
                  </h2>
                  <button
                    onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(data.targetKeyword)}`, '_blank')}
                    className="p-1 text-gray-500 hover:text-blue-500 transition-colors flex-shrink-0"
                    title="在 Google 中搜索"
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      className="w-4 h-4"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                      />
                    </svg>
                  </button>
                </div>
              </div>
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
