'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useStore } from '../store'
import { TrendsData, ComparisonPoint, UploadState } from '../types'

const GPTS_DAILY_VOLUME = 5000 // GPTs 基准搜索量
const BATCH_SIZE = 5 // 批量处理大小
const MAX_RETRIES = 3 // 最大重试次数

export default function FileUploader() {
  const { addTrendsData } = useStore()
  const [error, setError] = useState<string | null>(null)
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0
  })

  const processCSV = async (file: File): Promise<TrendsData | null> => {
    try {
      const text = await file.text()
      const lines = text.split('\n')
      
      // 直接使用第3行（索引2）作为表头行
      const headerIndex = 2
      let targetKeyword = ''
      
      const parseCsvLine = (line: string) => {
        const result = []
        let cell = ''
        let inQuotes = false
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i]
          if (char === '"') {
            inQuotes = !inQuotes
          } else if (char === ',' && !inQuotes) {
            result.push(cell)
            cell = ''
          } else {
            cell += char
          }
        }
        result.push(cell)
        return result.map(cell => cell.replace(/^"|"$/g, '').trim())
      }
      
      // 解析表头行
      const headerLine = lines[headerIndex]?.trim()
      if (!headerLine) {
        throw new Error(`文件 ${file.name} 格式不正确：找不到表头行`)
      }
      
      const headerCells = parseCsvLine(headerLine)
      if (headerCells.length < 3) {
        throw new Error(`文件 ${file.name} 格式不正确：表头列数不足`)
      }
      
      // 使用第三列（索引2）作为目标关键词
      targetKeyword = headerCells[2]
        .replace(/: \((全球|Worldwide|[^)]+)\)/, '')  // 移除任何括号中的地区标识
        .trim()
      
      if (!targetKeyword) {
        throw new Error(`文件 ${file.name} 格式不正确：无法获取关键词`)
      }

      // 从表头的下一行开始处理数据
      const dataStartIndex = headerIndex + 1
      const comparisonData: ComparisonPoint[] = lines.slice(dataStartIndex)
        .map((line, index) => {
          if (!line.trim()) return null
          
          const cells = parseCsvLine(line)
          if (cells.length < 3) return null

          const date = cells[0]
          const gptsValue = parseFloat(cells[1] || '0')
          // 处理特殊值 "<1"
          const rawTargetValue = cells[2]
          const targetValue = rawTargetValue === '<1' ? 0.5 : parseFloat(rawTargetValue || '0')
          
          if (!date || isNaN(gptsValue) || isNaN(targetValue)) return null

          // 将日期格式标准化（支持两种格式）
          const standardDate = date.includes('-') ? date : 
            date.replace(/(\d{4})\/(\d{1,2})\/(\d{1,2})/, 
              (_, year, month, day) => {
                return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
              }
            )

          const targetDailyVolume = (targetValue / gptsValue) * GPTS_DAILY_VOLUME
          const targetMonthlyVolume = targetDailyVolume * 30

          return {
            date: standardDate,
            gpts: gptsValue,
            keyword: targetValue,
            dailyVolume: Math.round(targetDailyVolume),
            monthlyVolume: Math.round(targetMonthlyVolume)
          }
        })
        .filter(Boolean) as ComparisonPoint[]

      if (comparisonData.length === 0) {
        throw new Error(`文件 ${file.name} 没有有效的数据行`)
      }

      // 计算最后7天的平均搜索量
      const lastWeekData = comparisonData.slice(-7)
      const lastWeekVolume = Math.round(
        lastWeekData.reduce((sum, point) => sum + point.dailyVolume, 0) / 
        lastWeekData.length
      )

      // 计算月均搜索量
      const monthlyAverage = Math.round(
        comparisonData.reduce((sum, point) => sum + point.monthlyVolume, 0) / 
        comparisonData.length
      )

      // 检查数据是否有效
      if (lastWeekVolume === 0 && monthlyAverage === 0) {
        console.log(`跳过无效数据: ${file.name} (关键词: ${targetKeyword})，月均和近七日均为0`)
        return null
      }

      return {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        fileName: file.name,
        targetKeyword,
        comparisonData,
        lastWeekVolume,
        reviewed: false,
        chartConfig: {
          title: `${targetKeyword} vs GPTs 趋势对比`,
          timeRange: `${comparisonData[0].date} - ${comparisonData[comparisonData.length-1].date}`,
          displayOptions: {
            showLegend: true,
            showTooltip: true,
            showVolume: true
          }
        }
      } as TrendsData
    } catch (error) {
      console.error(`处理文件 ${file.name} 时出错:`, error)
      setError(`处理文件 ${file.name} 失败: ${error instanceof Error ? error.message : '未知错误'}`)
      return null
    }
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null)
    if (acceptedFiles.length === 0) return
    
    setUploadState({ isUploading: true, progress: 0 })
    
    try {
      const processedDataArray: TrendsData[] = []
      
      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i]
        setUploadState((prev: UploadState) => ({ 
          ...prev,
          progress: Math.round((i / acceptedFiles.length) * 100) 
        }))
        
        const data = await processCSV(file)
        if (data) {
          processedDataArray.push(data)
        }
      }
      
      if (processedDataArray.length > 0) {
        await addTrendsData(processedDataArray)
        console.log(`成功处理 ${processedDataArray.length} 个文件`)
      } else {
        console.log('没有有效的数据需要保存')
      }
      
    } catch (error) {
      console.error('处理文件时出错:', error)
      setError(error instanceof Error ? error.message : '处理文件时发生未知错误')
    } finally {
      setUploadState({ isUploading: false, progress: 0 })
    }
  }, [addTrendsData])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    multiple: true
  })

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      
      <div 
        {...getRootProps()} 
        className={`
          border-2 border-dashed rounded-lg p-8
          ${isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300'}
          transition-colors duration-200
        `}
      >
        <input {...getInputProps()} />
        <div className="text-center">
          {uploadState.progress > 0 ? (
            <div className="space-y-2">
              <div className="text-gray-600">
                正在处理文件... ({uploadState.progress}%)
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${uploadState.progress}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <p className="text-gray-600 mb-2">
                {isDragActive ? 
                  '放开以上传文件' : 
                  '拖拽 CSV 文件到这里或点击上传'
                }
              </p>
              <button
                type="button"
                className="px-4 py-2 bg-black text-white rounded-full
                          hover:bg-gray-800 transition-colors"
                onClick={() => {}}
              >
                选择文件
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
} 