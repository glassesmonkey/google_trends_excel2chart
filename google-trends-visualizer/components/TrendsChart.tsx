'use client'

import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import { TrendsData, ComparisonPoint } from '../types'

interface TrendsChartProps {
  data: TrendsData
}

interface PeriodData {
  startDate: string
  endDate: string
  avgValue: number
}

// 格式化数字为 K, M, B
const formatNumber = (num: number): string => {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + 'B'
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

// 计算新鲜度分数（0-100）
const calculateFreshnessScore = (data: ComparisonPoint[]): number => {
  const RECENT_WEIGHT = 2  // 最近数据的权重
  const TREND_WEIGHT = 1   // 趋势的权重
  const PERIODS = 4        // 将数据分为4个时期

  // 将数据分成几个时期
  const periodsData: number[] = []
  const periodLength = Math.floor(data.length / PERIODS)
  
  for (let i = 0; i < PERIODS; i++) {
    const start = i * periodLength
    const end = i === PERIODS - 1 ? data.length : (i + 1) * periodLength
    const periodData = data.slice(start, end)
    const avgValue = periodData.reduce((sum, p) => sum + p.keyword, 0) / periodData.length
    periodsData.push(avgValue)
  }

  // 计算最近期的平均值
  const recentAvg = periodsData[PERIODS - 1]
  
  // 计算历史期的平均值
  const historicalAvg = periodsData.slice(0, -1).reduce((sum, val) => sum + val, 0) / (PERIODS - 1)
  
  // 计算趋势（是否上升）
  const trend = periodsData.every((val, i) => 
    i === 0 || val >= periodsData[i - 1] * 0.8  // 允许20%的波动
  ) ? 1 : 0

  // 计算新鲜度分数
  const recentScore = Math.min(100, (recentAvg / historicalAvg) * 50) || 0
  const trendScore = trend * 50

  return Math.round(
    (recentScore * RECENT_WEIGHT + trendScore * TREND_WEIGHT) / (RECENT_WEIGHT + TREND_WEIGHT)
  )
}

export default function TrendsChart({ data }: TrendsChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  // 计算月平均搜索量
  const averageMonthlyVolume = Math.round(
    data.comparisonData.reduce((sum, point) => sum + point.monthlyVolume, 0) / 
    data.comparisonData.length
  )

  // 计算新鲜度分数
  const freshnessScore = calculateFreshnessScore(data.comparisonData)

  useEffect(() => {
    if (!chartRef.current) return

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current)
    }

    const dates = data.comparisonData.map(point => point.date)
    const gptsData = data.comparisonData.map(point => point.gpts)
    const keywordData = data.comparisonData.map(point => point.keyword)

    const option = {
      title: [
        {
          text: data.chartConfig?.title,
          left: 'center',
          top: 5,
          textStyle: {
            fontSize: 14,
            fontWeight: 'normal'
          }
        },
        {
          text: [
            `月均搜索量: ${formatNumber(averageMonthlyVolume)}`,
            `新鲜度: ${freshnessScore}%`
          ].join('    '),
          top: 30,
          left: 'center',
          textStyle: {
            fontSize: 12,
            color: '#666',
            fontWeight: 'normal'
          }
        }
      ],
      tooltip: {
        trigger: 'axis',
        formatter: function (params: any[]) {
          const date = params[0].axisValue
          const point = data.comparisonData.find(p => p.date === date)
          if (!point) return ''
          
          return `
            <div class="font-sans text-sm">
              <div class="font-bold">${date}</div>
              <div>GPTs: ${point.gpts}</div>
              <div>${data.targetKeyword}: ${point.keyword}</div>
              <div class="mt-1 pt-1 border-t text-xs">
                <div>预估搜索量：</div>
                <div>日均：${formatNumber(point.dailyVolume)}</div>
                <div>月均：${formatNumber(point.monthlyVolume)}</div>
              </div>
            </div>
          `
        }
      },
      legend: {
        data: ['GPTs', data.targetKeyword],
        top: 50,
        textStyle: {
          fontSize: 12
        }
      },
      grid: {
        top: 80,  // 增加顶部空间以容纳新的指标
        left: '8%',
        right: '8%',
        bottom: '12%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates,
        axisLabel: {
          fontSize: 10,
          interval: 'auto',
          rotate: 45
        }
      },
      yAxis: {
        type: 'value',
        name: '相对趋势值',
        nameTextStyle: {
          fontSize: 10
        },
        axisLabel: {
          fontSize: 10
        },
        splitLine: {
          show: true,
          lineStyle: {
            type: 'dashed',
            opacity: 0.3
          }
        }
      },
      series: [
        {
          name: 'GPTs',
          type: 'line',
          data: gptsData,
          smooth: true,
          lineStyle: {
            width: 2
          },
          symbolSize: 4
        },
        {
          name: data.targetKeyword,
          type: 'line',
          data: keywordData,
          smooth: true,
          lineStyle: {
            width: 2
          },
          symbolSize: 4
        }
      ]
    }

    chartInstance.current.setOption(option)

    return () => {
      chartInstance.current?.dispose()
      chartInstance.current = null
    }
  }, [data, averageMonthlyVolume, freshnessScore])

  useEffect(() => {
    const handleResize = () => {
      chartInstance.current?.resize()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return <div ref={chartRef} className="w-full aspect-[16/9]" />
} 