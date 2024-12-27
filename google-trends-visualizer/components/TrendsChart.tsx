'use client'

import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import { TrendsData, ComparisonPoint } from '../types'
import { calculateFreshnessScore } from '../utils/calculations'

interface TrendsChartProps {
  data: TrendsData
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

interface TooltipParams {
  axisValue: string
  // 添加其他可能需要的属性
}

export default function TrendsChart({ data }: TrendsChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  // 计算月平均搜索量
  const averageMonthlyVolume = Math.round(
    data.comparisonData.reduce((sum, point) => sum + point.monthlyVolume, 0) / 
    data.comparisonData.length
  )

  // 使用新的计算函数
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
        formatter: function (params: TooltipParams[]) {
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