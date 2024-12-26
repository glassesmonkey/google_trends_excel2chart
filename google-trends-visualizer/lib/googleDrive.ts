import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { TrendsData } from '../types'

const SCOPES = ['https://www.googleapis.com/auth/drive.file']
const DATA_FOLDER_NAME = 'GoogleTrendsVisualizer'

class GoogleDriveService {
  private oauth2Client: OAuth2Client
  private drive: any
  private folderId: string | null = null

  constructor() {
    this.oauth2Client = new OAuth2Client({
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI
    })

    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client })
  }

  async init() {
    if (!this.folderId) {
      this.folderId = await this.getOrCreateFolder()
    }
  }

  // 获取授权URL
  getAuthUrl() {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES
    })
  }

  // 设置凭证
  async setCredentials(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code)
    this.oauth2Client.setCredentials(tokens)
    localStorage.setItem('googleDriveTokens', JSON.stringify(tokens))
  }

  // 恢复已保存的凭证
  restoreTokens() {
    const tokens = localStorage.getItem('googleDriveTokens')
    if (tokens) {
      this.oauth2Client.setCredentials(JSON.parse(tokens))
      return true
    }
    return false
  }

  // 获取或创建数据文件夹
  private async getOrCreateFolder() {
    try {
      // 查找现有文件夹
      const response = await this.drive.files.list({
        q: `name='${DATA_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder'`,
        fields: 'files(id)'
      })

      if (response.data.files?.length) {
        return response.data.files[0].id
      }

      // 创建新文件夹
      const folder = await this.drive.files.create({
        requestBody: {
          name: DATA_FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder'
        },
        fields: 'id'
      })

      return folder.data.id
    } catch (error) {
      console.error('获取/创建文件夹失败:', error)
      throw error
    }
  }

  // 保存数据
  async saveData(data: TrendsData[]) {
    await this.init()
    
    const fileContent = JSON.stringify(data)
    const fileName = 'trends_data.json'

    try {
      // 查找现有文件
      const response = await this.drive.files.list({
        q: `name='${fileName}' and '${this.folderId}' in parents`,
        fields: 'files(id)'
      })

      if (response.data.files?.length) {
        // 更新现有文件
        await this.drive.files.update({
          fileId: response.data.files[0].id,
          media: {
            mimeType: 'application/json',
            body: fileContent
          }
        })
      } else {
        // 创建新文件
        await this.drive.files.create({
          requestBody: {
            name: fileName,
            parents: [this.folderId]
          },
          media: {
            mimeType: 'application/json',
            body: fileContent
          }
        })
      }
    } catch (error) {
      console.error('保存数据失败:', error)
      throw error
    }
  }

  // 加载数据
  async loadData(): Promise<TrendsData[]> {
    await this.init()

    try {
      const response = await this.drive.files.list({
        q: `name='trends_data.json' and '${this.folderId}' in parents`,
        fields: 'files(id)'
      })

      if (!response.data.files?.length) {
        return []
      }

      const fileId = response.data.files[0].id
      const file = await this.drive.files.get({
        fileId,
        alt: 'media'
      })

      return file.data
    } catch (error) {
      console.error('加载数据失败:', error)
      throw error
    }
  }
}

export const googleDriveService = new GoogleDriveService() 