import { ComparisonPoint } from '../types'

export const calculateFreshnessScore = (data: ComparisonPoint[]): number => {
  const maxScore = 100

  // 按时间排序，找出数据集中的最新日期
  const sortedData = [...data].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  // 按时间段分组检查流量
  const periods = [
    { days: 7, score: 100 },    // 只在最近7天有流量
    { days: 14, score: 90 },    // 只在最近14天有流量
    { days: 30, score: 80 },    // 只在最近30天有流量
    { days: 60, score: 60 },    // 只在最近60天有流量
    { days: 90, score: 40 },    // 只在最近90天有流量
    { days: 180, score: 20 },   // 只在最近180天有流量
    { days: Infinity, score: 10 } // 更早就有流量
  ]

  const latestDate = new Date(sortedData[0].date)

  // 遍历每个时间段
  for (const period of periods) {
    const cutoffDate = new Date(latestDate)
    cutoffDate.setDate(cutoffDate.getDate() - period.days)

    // 分割数据为当前时间段和之前的数据
    const recentData = sortedData.filter(point => 
      new Date(point.date) > cutoffDate
    )
    const olderData = sortedData.filter(point => 
      new Date(point.date) <= cutoffDate
    )

    // 检查当前时间段是否有流量
    const hasRecentTraffic = recentData.some(point => point.keyword > 0)
    // 检查之前的时间段是否都没有流量
    const hasOlderTraffic = olderData.some(point => point.keyword > 0)

    // 如果只在当前时间段有流量，之前都没有，就用这个分数
    if (hasRecentTraffic && !hasOlderTraffic) {
      console.log('新鲜度计算:', {
        latestDataDate: latestDate.toISOString(),
        periodDays: period.days,
        score: period.score,
        hasRecentTraffic,
        hasOlderTraffic,
        recentData: recentData.map(p => ({
          date: p.date,
          value: p.keyword
        })),
        olderData: olderData.map(p => ({
          date: p.date,
          value: p.keyword
        }))
      })
      return period.score
    }
  }

  // 如果所有时期都有流量，返回最低分
  return 10
} 