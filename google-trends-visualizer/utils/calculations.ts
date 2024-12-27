import { ComparisonPoint, TrendsData } from '../types'

export const calculateFreshnessScore = (comparisonData: ComparisonPoint[]): number => {
  if (!comparisonData || comparisonData.length === 0) {
    return 0
  }

  const sortedData = [...comparisonData].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  const latestDate = new Date(sortedData[0].date)
  
  // 计算平均流量作为基准
  const avgTraffic = sortedData.reduce((sum, point) => sum + point.keyword, 0) / sortedData.length
  // 设置流量阈值为平均流量的10%
  const trafficThreshold = avgTraffic * 0.1

  const periods = [
    { days: 7, score: 100 },
    { days: 14, score: 90 },
    { days: 30, score: 80 },
    { days: 60, score: 60 },
    { days: 90, score: 40 },
    { days: 180, score: 20 },
    { days: Infinity, score: 10 }
  ]

  for (const period of periods) {
    const cutoffDate = new Date(latestDate)
    cutoffDate.setDate(cutoffDate.getDate() - period.days)

    const recentData = sortedData.filter(point => 
      new Date(point.date) > cutoffDate
    )
    const olderData = sortedData.filter(point => 
      new Date(point.date) <= cutoffDate
    )

    // 计算当前时段的平均流量
    const recentAvg = recentData.reduce((sum, point) => sum + point.keyword, 0) / recentData.length
    // 计算历史时段的平均流量
    const olderAvg = olderData.length ? 
      olderData.reduce((sum, point) => sum + point.keyword, 0) / olderData.length : 
      0

    // 检查是否符合"新兴趋势"的条件：
    // 1. 当前时段平均流量超过阈值
    // 2. 当前时段的流量显著高于历史时段（比如是历史的2倍以上）
    const hasSignificantRecentTraffic = recentAvg > trafficThreshold
    const isSignificantIncrease = olderAvg === 0 || (recentAvg / olderAvg >= 2)

    if (hasSignificantRecentTraffic && isSignificantIncrease) {
      return period.score
    }
  }

  return 10
} 