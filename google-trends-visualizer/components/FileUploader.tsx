'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useStore } from '../store'
import { TrendsData, ComparisonPoint } from '../types'

const GPTS_DAILY_VOLUME = 5000 // GPTs 基准搜索量

export default function FileUploader() {
  const { addTrendsData } = useStore()
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  const processCSV = async (file: File) => {
    try {
      const text = await file.text()
      const lines = text.split('\n')
      
      console.log('CSV 文件内容:', {
        fileName: file.name,
        totalLines: lines.length,
        firstFewLines: lines.slice(0, 5)
      })
      
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
      console.log('表头行:', {
        line: headerLine,
        cells: headerCells
      })
      
      if (headerCells.length < 3) {
        throw new Error(`文件 ${file.name} 格式不正确：表头列数不足`)
      }
      
      // 使用第三列（索引2）作为目标关键词
      targetKeyword = headerCells[2]
        .replace(/: \((全球|Worldwide|[^)]+)\)/, '')  // 移除任何括号中的地区标识
        .trim()
      
      console.log('提取到关键词:', targetKeyword)
      
      if (!targetKeyword) {
        throw new Error(`文件 ${file.name} 格式不正确：无法获取关键词`)
      }

      // 从表头的下一行开始处理数据
      const dataStartIndex = headerIndex + 1

      console.log('开始处理数据行:', {
        dataStartIndex,
        targetKeyword,
        remainingLines: lines.slice(dataStartIndex, dataStartIndex + 3)
      })

      const comparisonData: ComparisonPoint[] = lines.slice(dataStartIndex)
        .map((line, index) => {
          if (!line.trim()) return null
          
          const cells = parseCsvLine(line)
          if (cells.length < 3) {
            console.log(`跳过无效行 ${index + dataStartIndex + 1}:`, {
              line,
              cellCount: cells.length
            })
            return null
          }

          const date = cells[0]
          const gptsValue = parseFloat(cells[1] || '0')
          // 处理特殊值 "<1"
          const rawTargetValue = cells[2]
          const targetValue = rawTargetValue === '<1' ? 0.5 : parseFloat(rawTargetValue || '0')
          
          if (!date || isNaN(gptsValue) || isNaN(targetValue)) {
            console.log(`跳过数据无效的行 ${index + dataStartIndex + 1}:`, {
              date,
              gptsValue,
              targetValue,
              rawCells: cells
            })
            return null
          }

          // 将日期格式标准化（支持两种格式）
          const standardDate = date.includes('-') ? date : 
            date.replace(/(\d{4})\/(\d{1,2})\/(\d{1,2})/, 
              (_, year, month, day) => {
                return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
              }
            )

          const targetDailyVolume = (targetValue / gptsValue) * GPTS_DAILY_VOLUME
          const targetMonthlyVolume = targetDailyVolume * 30

          const point = {
            date: standardDate,
            gpts: gptsValue,
            keyword: targetValue,
            dailyVolume: Math.round(targetDailyVolume),
            monthlyVolume: Math.round(targetMonthlyVolume)
          }

          console.log(`处理数据行 ${index + dataStartIndex + 1}:`, point)
          return point
        })
        .filter(Boolean) as ComparisonPoint[]

      console.log('数据处理完成:', {
        fileName: file.name,
        totalPoints: comparisonData.length,
        firstPoint: comparisonData[0],
        lastPoint: comparisonData[comparisonData.length - 1]
      })

      if (comparisonData.length === 0) {
        throw new Error(`文件 ${file.name} 没有有效的数据行`)
      }

      // 计算最后7天的平均搜索量
      const lastWeekData = comparisonData.slice(-7)
      const lastWeekVolume = Math.round(
        lastWeekData.reduce((sum, point) => sum + point.dailyVolume, 0) / 
        lastWeekData.length
      )

      return {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        fileName: file.name,
        targetKeyword,
        comparisonData,
        lastWeekVolume,
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
      return null
    }
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setProcessing(true)
    setProgress({ current: 0, total: acceptedFiles.length })

    try {
      // 使用 Promise.all 并限制并发数
      const batchSize = 5
      const results: TrendsData[] = []
      
      for (let i = 0; i < acceptedFiles.length; i += batchSize) {
        const batch = acceptedFiles.slice(i, i + batchSize)
        const batchResults = await Promise.all(batch.map(processCSV))
        
        const validResults = batchResults.filter(Boolean) as TrendsData[]
        validResults.forEach(data => addTrendsData(data))
        
        results.push(...validResults)
        setProgress({ current: i + batch.length, total: acceptedFiles.length })
      }

      console.log(`成功处理 ${results.length}/${acceptedFiles.length} 个文件`)
    } catch (error) {
      console.error('批量处理文件时出错:', error)
    } finally {
      setProcessing(false)
      setProgress({ current: 0, total: 0 })
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
        {processing ? (
          <div className="space-y-2">
            <div className="text-gray-600">
              正在处理文件... ({progress.current}/{progress.total})
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
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
              className="px-4 py-2 bg-black text-white rounded-full
                        hover:bg-gray-800 transition-colors"
            >
              选择文件
            </button>
          </>
        )}
      </div>
    </div>
  )
} 