import fs from 'node:fs'
import path from 'node:path'

import { getSessionDir } from '../config/index.js'
import type { Message } from './types.js'

export interface SessionData {
  id: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  metadata?: Record<string, unknown>
}

export interface SessionSummary {
  id: string
  updatedAt: number
  createdAt: number
  messageCount: number
  lastUserMessage?: string
}

function extractLastUserMessage(messages?: Message[]): string | undefined {
  if (!Array.isArray(messages) || messages.length === 0) return undefined
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg && msg.role === 'user' && typeof msg.content === 'string') {
      const cleaned = msg.content.replace(/[\r\n\t]+/g, ' ').trim()
      if (cleaned) return cleaned
    }
  }
  return undefined
}

function toSafeFileName(sessionId: string): string {
  const sanitized = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_')
  return sanitized || 'default'
}

export class SessionStore {
  private sessions: Map<string, SessionData> = new Map()
  private storageDir: string

  constructor(storageDir?: string) {
    this.storageDir = storageDir ?? getSessionDir()
  }

  private getSessionFilePath(sessionId: string): string {
    return path.join(this.storageDir, `${toSafeFileName(sessionId)}.json`)
  }

  private saveToDisk(session: SessionData): void {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true })
      }
      const filePath = this.getSessionFilePath(session.id)
      const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`
      const data = JSON.stringify(session, null, 2)
      fs.writeFileSync(tmpPath, data, 'utf-8')
      fs.renameSync(tmpPath, filePath)
    } catch (err) {
      console.warn(`[xi] 保存会话至磁盘失败 (${session.id}):`, err)
    }
  }

  getOrCreateSession(sessionId: string): SessionData {
    let session = this.getSession(sessionId)
    if (!session) {
      session = {
        id: sessionId,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      this.sessions.set(sessionId, session)
      this.saveToDisk(session)
    }
    return session
  }

  getSession(sessionId: string): SessionData | undefined {
    let session = this.sessions.get(sessionId)
    if (session) return session

    const filePath = this.getSessionFilePath(sessionId)
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        session = JSON.parse(content) as SessionData
        if (session && session.id) {
          this.sessions.set(sessionId, session)
          return session
        }
      } catch (err) {
        console.warn(`[xi] 读取会话文件失败 (${filePath}):`, err)
      }
    }

    return undefined
  }

  has(sessionId: string): boolean {
    if (this.sessions.has(sessionId)) return true
    const filePath = this.getSessionFilePath(sessionId)
    return fs.existsSync(filePath)
  }

  getMessages(sessionId: string): Message[] {
    const session = this.getSession(sessionId)
    return session ? [...session.messages] : []
  }

  appendMessage(sessionId: string, message: Message): void {
    const session = this.getOrCreateSession(sessionId)
    session.messages.push(message)
    session.updatedAt = Date.now()
    this.saveToDisk(session)
  }

  setMessages(sessionId: string, messages: Message[]): void {
    const session = this.getOrCreateSession(sessionId)
    session.messages = [...messages]
    session.updatedAt = Date.now()
    this.saveToDisk(session)
  }

  clearMessages(sessionId: string): void {
    const session = this.getSession(sessionId)
    if (session) {
      session.messages = []
      session.updatedAt = Date.now()
      this.saveToDisk(session)
    }
  }

  delete(sessionId: string): boolean {
    const inMemory = this.sessions.delete(sessionId)
    const filePath = this.getSessionFilePath(sessionId)
    let fileDeleted = false
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath)
        fileDeleted = true
      } catch (err) {
        console.warn(`[xi] 删除会话文件失败 (${filePath}):`, err)
      }
    }
    return inMemory || fileDeleted
  }

  getAllSessions(): SessionSummary[] {
    const sessionMap = new Map<string, SessionSummary>()

    // 1. 扫描磁盘
    if (fs.existsSync(this.storageDir)) {
      try {
        const files = fs.readdirSync(this.storageDir)
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(this.storageDir, file)
            try {
              const content = fs.readFileSync(filePath, 'utf-8')
              const parsed = JSON.parse(content) as SessionData
              if (parsed && parsed.id) {
                sessionMap.set(parsed.id, {
                  id: parsed.id,
                  updatedAt: parsed.updatedAt || parsed.createdAt || 0,
                  createdAt: parsed.createdAt || 0,
                  messageCount: Array.isArray(parsed.messages) ? parsed.messages.length : 0,
                  lastUserMessage: extractLastUserMessage(parsed.messages),
                })
              }
            } catch {
              // 忽略损坏文件
            }
          }
        }
      } catch (err) {
        console.warn(`[xi] 扫描会话目录失败 (${this.storageDir}):`, err)
      }
    }

    // 2. 内存中的活跃 session 覆写/补充（保证最新变更即时体现）
    for (const [id, session] of this.sessions.entries()) {
      sessionMap.set(id, {
        id: session.id,
        updatedAt: session.updatedAt,
        createdAt: session.createdAt,
        messageCount: session.messages.length,
        lastUserMessage: extractLastUserMessage(session.messages),
      })
    }

    // 3. 严格按 updatedAt 降序排序
    return Array.from(sessionMap.values()).sort((a, b) => b.updatedAt - a.updatedAt)
  }

  getAllSessionIds(): string[] {
    return this.getAllSessions().map((s) => s.id)
  }
}
