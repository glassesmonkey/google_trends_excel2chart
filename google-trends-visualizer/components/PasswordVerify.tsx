'use client'

import { useState, useEffect } from 'react'
import Cookies from 'js-cookie'

interface Props {
  onVerified: () => void
}

const PASSWORD = '809001'
const COOKIE_NAME = 'trends_verified'
const COOKIE_EXPIRES = 7 // 7天后过期

export default function PasswordVerify({ onVerified }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    // 检查 cookie
    const verified = Cookies.get(COOKIE_NAME)
    if (verified === 'true') {
      onVerified()
    }
  }, [onVerified])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === PASSWORD) {
      // 设置 cookie
      Cookies.set(COOKIE_NAME, 'true', { expires: COOKIE_EXPIRES })
      onVerified()
    } else {
      setError('密码错误')
      setPassword('')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">请输入访问密码</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setError('')
                setPassword(e.target.value)
              }}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入密码"
              autoFocus
            />
          </div>
          {error && (
            <div className="text-red-500 text-sm text-center">
              {error}
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            确认
          </button>
        </form>
      </div>
    </div>
  )
} 