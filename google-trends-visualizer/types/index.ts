export interface TrendsData {
  id: string
  timestamp: number
  fileName: string
  targetKeyword: string
  comparisonData: ComparisonPoint[]
  chartConfig?: ChartConfig
}

export interface ComparisonPoint {
  date: string
  gpts: number
  keyword: number
  dailyVolume: number
  monthlyVolume: number
}

export interface ChartConfig {
  title: string
  timeRange: string
  displayOptions: {
    showLegend: boolean
    showTooltip: boolean
    [key: string]: any
  }
}

export interface UploadState {
  isUploading: boolean
  progress: number
  error?: string
} 