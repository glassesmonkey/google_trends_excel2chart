const DATA_FOLDER_NAME = 'GoogleTrendsVisualizer'

class GoogleDriveService {
  private token: string | null = null
  private folderId: string | null = null

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

  setToken(token: string) {
    this.token = token
    localStorage.setItem('googleDriveToken', token)
  }

  restoreToken() {
    const token = localStorage.getItem('googleDriveToken')
    if (token) {
      this.token = token
      return true
    }
    return false
  }

  private async getOrCreateFolder() {
    if (!this.token) throw new Error('Not authenticated')

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

  async saveData(data: any) {
    if (!this.token) throw new Error('Not authenticated')
    
    if (!this.folderId) {
      this.folderId = await this.getOrCreateFolder()
    }

    const fileName = 'trends_data.json'
    const fileContent = JSON.stringify(data)

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

    if (searchResult.files?.length) {
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
  }

  async loadData() {
    if (!this.token) throw new Error('Not authenticated')
    
    if (!this.folderId) {
      this.folderId = await this.getOrCreateFolder()
    }

    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='trends_data.json' and '${this.folderId}' in parents`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      }
    )

    const searchResult = await searchResponse.json()

    if (!searchResult.files?.length) {
      return []
    }

    const fileId = searchResult.files[0].id
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      }
    )

    return response.json()
  }
}

export const googleDriveService = new GoogleDriveService() 