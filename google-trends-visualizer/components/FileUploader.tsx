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
      
      const headers = lines[2].split(',')
      const targetKeywordCell = headers[2]?.trim() || ''
      const targetKeyword = targetKeywordCell.split(': ')[0]

      const comparisonData: ComparisonPoint[] = lines.slice(3)
        .map(line => {
          const cells = line.split(',')
          if (cells.length < 3) return null

          const date = cells[0]?.trim()
          const gptsValue = parseFloat(cells[1]?.trim() || '0')
          const targetValue = parseFloat(cells[2]?.trim() || '0')
          
          if (!date || isNaN(gptsValue) || isNaN(targetValue)) return null

          const targetDailyVolume = (targetValue / gptsValue) * GPTS_DAILY_VOLUME
          const targetMonthlyVolume = targetDailyVolume * 30

          return {
            date,
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

      return {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        fileName: file.name,
        targetKeyword,
        comparisonData,
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