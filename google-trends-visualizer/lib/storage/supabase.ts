import { createClient } from '@supabase/supabase-js'
import { TrendsData } from '../../types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export class SupabaseService {
  // 基础数据操作
  async upsertData(data: TrendsData[]) {
    const { data: result, error } = await supabase
      .from('trends_data')
      .upsert(
        data.map(item => ({
          id: item.id,
          target_keyword: item.targetKeyword,
          file_name: item.fileName,
          timestamp: item.timestamp,
          last_week_volume: item.lastWeekVolume,
          reviewed: item.reviewed,
          comparison_data: item.comparisonData,
          chart_config: item.chartConfig,
          updated_at: new Date().toISOString()
        })),
        { 
          onConflict: 'target_keyword',
          ignoreDuplicates: false
        }
      )

    if (error) throw error
    return result
  }

  async getData(options: {
    reviewed?: boolean
    limit?: number
    offset?: number
    searchTerm?: string
  }) {
    let query = supabase
      .from('trends_data')
      .select('*')

    if (typeof options.reviewed === 'boolean') {
      query = query.eq('reviewed', options.reviewed)
    }

    if (options.searchTerm) {
      query = query.ilike('target_keyword', `%${options.searchTerm}%`)
    }

    if (options.limit) {
      query = query.limit(options.limit)
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
    }

    const { data, error } = await query

    if (error) throw error
    return data?.map(item => ({
      id: item.id,
      targetKeyword: item.target_keyword,
      fileName: item.file_name,
      timestamp: item.timestamp,
      lastWeekVolume: item.last_week_volume,
      reviewed: item.reviewed,
      comparisonData: item.comparison_data,
      chartConfig: item.chart_config
    }))
  }

  async updateReviewStatus(keywords: string[], reviewed: boolean) {
    console.log('Supabase: 正在更新状态:', { keywords, reviewed })
    
    const { data, error } = await supabase
      .from('trends_data')
      .update({ 
        reviewed,
        updated_at: new Date().toISOString() 
      })
      .in('target_keyword', keywords)
      .select()

    if (error) {
      console.error('Supabase: 更新状态失败:', error)
      throw error
    }

    console.log('Supabase: 更新状态成功:', data)
    
    if (!data || data.length === 0) {
      console.warn('Supabase: 没有找到要更新的数据')
      return []
    }

    return data.map(item => ({
      id: item.id,
      targetKeyword: item.target_keyword,
      fileName: item.file_name,
      timestamp: item.timestamp,
      lastWeekVolume: item.last_week_volume,
      reviewed: item.reviewed,
      comparisonData: item.comparison_data,
      chartConfig: item.chart_config
    }))
  }

  async deleteReviewedData() {
    const { data, error } = await supabase
      .from('trends_data')
      .delete()
      .eq('reviewed', true)

    if (error) throw error
    return data
  }

  // 批量操作
  async batchUpsert(data: TrendsData[], batchSize: number = 100) {
    const batches = []
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize))
    }

    const results = []
    for (const batch of batches) {
      const result = await this.upsertData(batch)
      results.push(result)
      // 添加小延迟避免请求过快
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return results.flat()
  }

  // 同步相关
  async getLastUpdated(): Promise<string | null> {
    const { data, error } = await supabase
      .from('trends_data')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)

    if (error) throw error
    return data?.[0]?.updated_at || null
  }

  async getUpdatedSince(timestamp: string) {
    const { data, error } = await supabase
      .from('trends_data')
      .select('*')
      .gt('updated_at', timestamp)

    if (error) throw error
    return data?.map(item => ({
      id: item.id,
      targetKeyword: item.target_keyword,
      fileName: item.file_name,
      timestamp: item.timestamp,
      lastWeekVolume: item.last_week_volume,
      reviewed: item.reviewed,
      comparisonData: item.comparison_data,
      chartConfig: item.chart_config
    }))
  }

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }
}

export const supabaseService = new SupabaseService() 