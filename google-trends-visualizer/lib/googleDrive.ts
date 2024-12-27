import { TrendsData } from '../types'

const DATA_FOLDER_NAME = 'GoogleTrendsVisualizer'

class GoogleDriveService {
  private token: string | null = null
  private folderId: string | null = null
  private tokenExpiry: number | null = null

  // 获取授权URL
  getAuthUrl() {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    const redirectUri = process.env.NEXT_PUBLIC_REDIRECT_URI
    const scope = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.appdata'
    ].join(' ')

    return `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${redirectUri}&` +
      `response_type=token&` +
      `scope=${encodeURIComponent(scope)}`
  }

  setToken(token: string, expiresIn: number) {
    this.token = token
    this.tokenExpiry = Date.now() + (expiresIn * 1000)
    localStorage.setItem('googleDriveToken', token)
    localStorage.setItem('tokenExpiry', this.tokenExpiry.toString())
  }

  restoreToken() {
    const token = localStorage.getItem('googleDriveToken')
    const expiry = localStorage.getItem('tokenExpiry')
    
    if (token && expiry) {
      const expiryTime = parseInt(expiry)
      console.log('Restoring token:', {
        currentTime: Date.now(),
        expiryTime: expiryTime,
        isValid: Date.now() < expiryTime
      })
      
      if (Date.now() < expiryTime) {
        this.token = token
        this.tokenExpiry = expiryTime
        return true
      } else {
        console.log('Token expired, clearing...')
        this.clearToken()
      }
    } else {
      console.log('No token found in localStorage')
    }
    return false
  }

  clearToken() {
    this.token = null
    this.tokenExpiry = null
    localStorage.removeItem('googleDriveToken')
    localStorage.removeItem('tokenExpiry')
  }

  private async checkAndRefreshToken() {
    console.log('Checking token:', {
      hasToken: !!this.token,
      hasExpiry: !!this.tokenExpiry,
      currentTime: Date.now(),
      expiryTime: this.tokenExpiry
    })

    if (!this.token || !this.tokenExpiry) {
      if (!this.restoreToken()) {
        alert('请先登录 Google 账号')
        window.location.href = this.getAuthUrl()
        throw new Error('Not authenticated')
      }
    }

    if (this.tokenExpiry && Date.now() > this.tokenExpiry - 5 * 60 * 1000) {
      alert('登录已过期，请重新登录')
      this.clearToken()
      window.location.href = this.getAuthUrl()
      throw new Error('Token expired')
    }
  }

  private async getOrCreateFolder() {
    await this.checkAndRefreshToken()

    // 查找现有文件夹
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${DATA_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder'`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      }
    )

    const searchResult = await searchResponse.json()
    
    if (searchResult.files?.length) {
      return searchResult.files[0].id
    }

    // 创建新文件夹
    const createResponse = await fetch(
      'https://www.googleapis.com/drive/v3/files',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: DATA_FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder'
        })
      }
    )

    const folder = await createResponse.json()
    return folder.id
  }

  async saveData(data: TrendsData[]) {
    await this.checkAndRefreshToken()
    
    if (!this.folderId) {
      this.folderId = await this.getOrCreateFolder()
    }

    // 过滤掉月均搜索量为0的数据
    const filteredData = data.filter(item => {
      const averageMonthlyVolume = item.comparisonData.reduce(
        (sum, point) => sum + point.monthlyVolume, 
        0
      ) / item.comparisonData.length

      if (averageMonthlyVolume === 0) {
        console.log(`过滤掉月均搜索量为0的数据: ${item.targetKeyword}`)
        return false
      }
      return true
    })

    console.log('准备保存数据:', {
      originalDataCount: data.length,
      filteredDataCount: filteredData.length,
      filteredDataIds: filteredData.map(d => d.id)
    })

    // 先获取现有数据
    const existingData = await this.loadData()
    console.log('获取到现有数据:', {
      existingDataCount: existingData.length,
      existingDataIds: existingData.map(d => d.id)
    })
    
    // 合并数据时也要过滤现有数据
    const filteredExistingData = existingData.filter(item => {
      const averageMonthlyVolume = item.comparisonData.reduce(
        (sum, point) => sum + point.monthlyVolume, 
        0
      ) / item.comparisonData.length

      return averageMonthlyVolume > 0
    })

    // 合并数据，使用 id 作为唯一标识符去重
    const mergedData = [...filteredExistingData, ...filteredData].reduce((acc: TrendsData[], current) => {
      const exists = acc.find(item => item.id === current.id)
      if (!exists) {
        console.log(`添加新数据: ${current.id} (${current.targetKeyword})`)
        acc.push(current)
      } else {
        // 如果数据已存在，使用较新的数据
        const index = acc.findIndex(item => item.id === current.id)
        if (current.timestamp > exists.timestamp) {
          console.log(`更新现有数据: ${current.id} (${current.targetKeyword})`, {
            oldTimestamp: exists.timestamp,
            newTimestamp: current.timestamp
          })
          acc[index] = current
        } else {
          console.log(`保留现有数据: ${exists.id} (${exists.targetKeyword})`, {
            existingTimestamp: exists.timestamp,
            newDataTimestamp: current.timestamp
          })
        }
      }
      return acc
    }, [])

    console.log('合并后的数据:', {
      mergedDataCount: mergedData.length,
      mergedDataIds: mergedData.map(d => d.id)
    })

    const fileName = 'trends_data.json'

    const fileContent = JSON.stringify(mergedData)

    // 查找现有文件
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and '${this.folderId}' in parents`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      }
    )

    const searchResult = await searchResponse.json()
    console.log('查找现有文件结果:', {
      filesFound: searchResult.files?.length || 0
    })

    if (searchResult.files?.length) {
      console.log(`更新现有文件: ${searchResult.files[0].id}`)
      // 更新现有文件
      await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${searchResult.files[0].id}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          },
          body: fileContent
        }
      )
    } else {
      console.log('创建新文件')
      // 创建新文件
      const metadata = {
        name: fileName,
        parents: [this.folderId]
      }

      const form = new FormData()
      form.append(
        'metadata',
        new Blob([JSON.stringify(metadata)], { type: 'application/json' })
      )
      form.append(
        'file',
        new Blob([fileContent], { type: 'application/json' })
      )

      await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`
          },
          body: form
        }
      )
    }

    console.log('数据保存完成')
    return mergedData
  }

  async loadData() {
    await this.checkAndRefreshToken()
    
    if (!this.folderId) {
      this.folderId = await this.getOrCreateFolder()
    }

    console.log('开始加载数据')

    // 查找所有数据文件
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='trends_data.json' and '${this.folderId}' in parents`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      }
    )

    const searchResult = await searchResponse.json()
    console.log('查找数据文件结果:', {
      filesFound: searchResult.files?.length || 0
    })

    if (!searchResult.files?.length) {
      console.log('未找到数据文件')
      return []
    }

    // 如果有多个文件，获取所有文件的数据并合并
    console.log('开始获取文件内容')
    const allData = await Promise.all(
      searchResult.files.map(async (file: { id: string }) => {
        console.log(`获取文件内容: ${file.id}`)
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
          {
            headers: {
              'Authorization': `Bearer ${this.token}`
            }
          }
        )
        const data = await response.json()
        console.log(`文件 ${file.id} 内容:`, {
          dataCount: Array.isArray(data) ? data.length : 'not an array',
          dataIds: Array.isArray(data) ? data.map(d => d.id) : 'N/A'
        })
        return data
      })
    )

    // 合并所有数据并去重
    console.log('开始合并数据')
    const mergedData = allData.flat().reduce((acc: TrendsData[], current) => {
      const exists = acc.find(item => item.id === current.id)
      if (!exists) {
        console.log(`添加新数据: ${current.id} (${current.targetKeyword})`)
        acc.push(current)
      } else {
        // 如果数据已存在，使用较新的数据
        const index = acc.findIndex(item => item.id === current.id)
        if (current.timestamp > exists.timestamp) {
          console.log(`更新现有数据: ${current.id} (${current.targetKeyword})`, {
            oldTimestamp: exists.timestamp,
            newTimestamp: current.timestamp
          })
          acc[index] = current
        } else {
          console.log(`保留现有数据: ${exists.id} (${exists.targetKeyword})`, {
            existingTimestamp: exists.timestamp,
            newDataTimestamp: current.timestamp
          })
        }
      }
      return acc
    }, []).filter(item => {
      const averageMonthlyVolume = item.comparisonData.reduce(
        (sum, point) => sum + point.monthlyVolume, 
        0
      ) / item.comparisonData.length

      return averageMonthlyVolume > 0
    })

    console.log('数据合并完成 (已过滤月均搜索量为0的数据):', {
      totalFiles: searchResult.files.length,
      mergedDataCount: mergedData.length,
      mergedDataIds: mergedData.map(d => d.id)
    })

    // 如果有多个文件，删除旧文件并保存合并后的数据
    if (searchResult.files.length > 1) {
      console.log('检测到多个文件，开始清理')
      // 删除所有旧文件
      await Promise.all(
        searchResult.files.map(async (file: { id: string }) => {
          console.log(`删除文件: ${file.id}`)
          await fetch(
            `https://www.googleapis.com/drive/v3/files/${file.id}`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${this.token}`
              }
            }
          )
        })
      )

      console.log('保存合并后的数据到新文件')
      await this.saveData(mergedData)
    }

    return mergedData
  }
}

export const googleDriveService = new GoogleDriveService() 