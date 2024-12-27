# Google Trends 数据可视化工具

## 项目功能

### 1. 数据处理与可视化
- 批量处理 Google Trends CSV 文件
- 生成交互式趋势对比图表
- 计算并展示关键指标：
  - 月均搜索量（基于 GPTs 5000 日均基准）
  - 新鲜度评分（基于历史数据分析）

### 2. 数据管理
- Google Drive 云端存储
- 多设备数据同步
- 本地数据缓存

### 3. 用户界面
- 拖拽式文件上传
- 批量文件处理
- 进度显示
- 响应式布局
- 无限滚动加载

### 4. 数据分析功能
- 关键词搜索
- 多维度排序：
  - 月均搜索量排序
  - 新鲜度排序
  - 时间顺序排序
- 趋势分析

## 技术栈

### 前端
- Next.js 15.1.2
- React
- TypeScript
- TailwindCSS
- ECharts (图表可视化)
- Zustand (状态管理)

### 数据存储
- Google Drive API
- 浏览器 LocalStorage

### 工具库
- react-dropzone (文件上传)
- react-intersection-observer (无限滚动)

## 项目结构

