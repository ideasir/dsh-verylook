/**
 * QuoteStore — 对话内图片/视频的「引用」状态管理。
 *
 * 与附件（pending files）完全独立：
 *  - 附件走 64px tile（输入框下方，缩略图）
 *  - 引用走输入框上方的横条（无缩略图，纯文本标识），发送时合并为引用标记
 *
 * 每个 session 维护一个引用列表，支持多条叠加；发送后清空。
 */

/** 一条引用（图片或视频）。 */
export interface QuoteItem {
  /** 唯一 id（时间戳+序号，用于 React key）。 */
  id: string
  /** 图片 | 视频。 */
  kind: 'image' | 'video'
  /** 显示名（取自 markdown alt，缺省用文件名）。 */
  name: string
  /** 源 URL（http/https 直链）。 */
  url: string
  /** 图片可选：宽×高（信息行已解析时）。 */
  width?: number
  height?: number
}

/** 引用列表的 store（sessionId → QuoteItem[]）。 */
export interface QuoteStore {
  /** 读取某 session 的引用列表。 */
  get(sessionId: string): QuoteItem[]
  /** 追加一条引用（重复 URL 自动去重）。 */
  add(sessionId: string, item: Omit<QuoteItem, 'id'>): void
  /** 删除一条引用。 */
  remove(sessionId: string, id: string): void
  /** 清空某 session 的引用（发送后调用）。 */
  clear(sessionId: string): void
  /** 订阅任意变化（返回退订函数）。 */
  subscribe(fn: () => void): () => void
}

/** 创建一个引用 store。 */
export function createQuoteStore(): QuoteStore {
  const map = new Map<string, QuoteItem[]>()
  const listeners = new Set<() => void>()

  const emit = (): void => {
    for (const fn of listeners) fn()
  }

  const get = (sessionId: string): QuoteItem[] => map.get(sessionId) ?? []

  const add = (sessionId: string, item: Omit<QuoteItem, 'id'>): void => {
    const list = map.get(sessionId) ?? []
    // 同一 URL 不重复引用
    if (list.some(q => q.url === item.url)) return
    const next: QuoteItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    }
    map.set(sessionId, [...list, next])
    emit()
  }

  const remove = (sessionId: string, id: string): void => {
    const list = map.get(sessionId)
    if (!list) return
    map.set(sessionId, list.filter(q => q.id !== id))
    emit()
  }

  const clear = (sessionId: string): void => {
    if (!map.has(sessionId)) return
    map.delete(sessionId)
    emit()
  }

  return { get, add, remove, clear, subscribe: (fn) => {
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  } }
}

/** 把引用列表合并成发送文本里的标记（模型可读）。 */
export function quotesToMarker(quotes: QuoteItem[]): string {
  if (quotes.length === 0) return ''
  const lines = quotes.map(q => {
    const kindLabel = q.kind === 'image' ? '图片' : '视频'
    const dim = q.kind === 'image' && q.width && q.height ? ` (${q.width}×${q.height})` : ''
    return `[引用${kindLabel}]${q.name}${dim} [f:${q.url}]`
  })
  return lines.join('\n')
}

/** 从文本里解析出引用标记（用于已发送消息渲染）。 */
export function parseQuoteMarkers(text: string): QuoteItem[] {
  const items: QuoteItem[] = []
  const re = /\[引用(图片|视频)\]([^\n]*?)(?:\s*\((\d+)×(\d+)\))?\s*\[f:([^\]]+)\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const kind = m[1] === '视频' ? 'video' : 'image'
    const name = (m[2] ?? '').trim()
    const url = (m[5] ?? '').trim()
    if (!url) continue
    items.push({
      id: `q-${items.length}`,
      kind,
      name,
      url,
      width: m[3] ? parseInt(m[3], 10) : undefined,
      height: m[4] ? parseInt(m[4], 10) : undefined,
    })
  }
  return items
}