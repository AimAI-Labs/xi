import type { Message } from './types.js'

export interface SessionData {
  id: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  metadata?: Record<string, unknown>
}

export class SessionStore {
  private sessions: Map<string, SessionData> = new Map()

  getOrCreateSession(sessionId: string): SessionData {
    let session = this.sessions.get(sessionId)
    if (!session) {
      session = {
        id: sessionId,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      this.sessions.set(sessionId, session)
    }
    return session
  }

  getSession(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId)
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  getMessages(sessionId: string): Message[] {
    const session = this.getSession(sessionId)
    return session ? [...session.messages] : []
  }

  appendMessage(sessionId: string, message: Message): void {
    const session = this.getOrCreateSession(sessionId)
    session.messages.push(message)
    session.updatedAt = Date.now()
  }

  setMessages(sessionId: string, messages: Message[]): void {
    const session = this.getOrCreateSession(sessionId)
    session.messages = [...messages]
    session.updatedAt = Date.now()
  }

  clearMessages(sessionId: string): void {
    const session = this.getSession(sessionId)
    if (session) {
      session.messages = []
      session.updatedAt = Date.now()
    }
  }

  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId)
  }

  getAllSessionIds(): string[] {
    return Array.from(this.sessions.keys())
  }
}
