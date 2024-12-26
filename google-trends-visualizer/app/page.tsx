'use client'

import { useEffect, useState } from 'react'
import { useStore } from '../store'
import FileUploader from '../components/FileUploader'
import TrendsChart from '../components/TrendsChart'
import { useInView } from 'react-intersection-observer'
import { googleDriveService } from '../lib/googleDrive'

const ITEMS_PER_PAGE = 12

export default function Home() {
  const { 
    trendsData, 
    isAuthenticated, 
    setAuthenticated, 
    loadFromDrive 
  } = useStore()
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE)
  const { ref, inView } = useInView({
    threshold: 0,
    delay: 100
  })

  // 处理 Google Drive 认证
  useEffect(() => {
    const initGoogleDrive = async () => {
      // 尝试恢复已保存的凭证
      if (googleDriveService.restoreTokens()) {
        setAuthenticated(true)
        await loadFromDrive()
        return
      }

      // 检查 URL 中是否有授权码
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get('code')
      
      if (code) {
        try {
          await googleDriveService.setCredentials(code)
          setAuthenticated(true)
          await loadFromDrive()
          // 清除 URL 中的授权码
          window.history.replaceState({}, '', '/')
        } catch (error) {
          console.error('Google Drive 认证失败:', error)
        }
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

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 font-[family-name:var(--font-geist-sans)]">
      <main className="max-w-[1920px] mx-auto">
        <div className="flex justify-between items-center mb-6">
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

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
          {trendsData.slice(0, displayCount).map((data) => (
            <div key={data.id} className="bg-white rounded-lg shadow-sm p-3">
              <h2 className="text-sm font-medium mb-2 truncate">
                {data.targetKeyword}
              </h2>
              <TrendsChart data={data} />
            </div>
          ))}
        </section>

        {trendsData.length > displayCount && (
          <div ref={ref} className="h-16 flex items-center justify-center mt-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
          </div>
        )}

        {trendsData.length === 0 && (
          <div className="text-center text-gray-500 mt-6">
            请上传 CSV 文件以查看趋势图表
          </div>
        )}
      </main>
    </div>
  )
}
