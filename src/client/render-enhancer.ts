/**
 * dsh-verylook — 通用媒体渲染增强器（client）。
 *
 * 扫描最终答案里由 markdown `![alt](url)` 渲染出的 <img>，统一增强成：
 *   - 图片：缩略图（CSS 即时限制，不闪大图）+ 点击放大 lightbox + 信息行（标题·分辨率·比例）+ 引用按钮
 *   - 视频（.mp4/.webm/.mov）：替换成 <video> 内嵌播放器 + 播放按钮 overlay + 信息行 + 引用按钮
 *
 * 设计要点：
 *   - 通用：不写死任何域名，任何 http(s) 图片/视频都增强（靠扩展名判视频）。
 *   - 只增强对话区：范围限定在 [data-conversation-scroll] 内，不碰头像/设置 UI。
 *   - 常开：纯展示层，与「看/理解」开关解耦；媒体为空时零开销。
 *   - 最小侵入：不移动 <img> 节点（React 拥有该节点），只用 CSS 限制尺寸 + 图片后插信息行；
 *     视频用 replaceWith 换成播放器（视频消息渲染后不再被 React 更新，安全）。
 *   - 幂等：data 标记防重复增强；React 重渲染后 MutationObserver 自动补增强。
 */

const THUMB_IMG = 420
const THUMB_VID = 480

/** 视频文件扩展名（扩展名判视频，不写死域名）。 */
const VIDEO_RE = /\.(mp4|webm|mov)(\?|#|$)/i

const CSS = [
  // 只限制「http(s) 直链图片」（markdown 渲染出的生成图），不碰 blob/原生附件图。
  // 图片一插入 DOM 就被 CSS 限制成缩略图，不依赖 JS 轮询（根除「先原图后缩小」）。
  // 弹窗内大图用 .dsh-vl-modal img / .dsh-vl-modal video 单独覆盖。
  '[data-conversation-scroll] img[src^="http"]:not(.dsh-vl-modal img){max-width:' + THUMB_IMG + 'px!important;max-height:' + THUMB_IMG + 'px!important;width:auto!important;height:auto!important;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);object-fit:contain;cursor:zoom-in;display:block;background:var(--dsw-alias-bg-base);animation:dsh-vl-fadein .25s ease-out}',
  '.dsh-vl-bar{display:flex;align-items:center;gap:8px;margin-top:5px;flex-wrap:wrap;max-width:' + THUMB_IMG + 'px}',
  '.dsh-vl-meta{font-size:11px;color:var(--dsw-alias-label-secondary);font-weight:600;white-space:nowrap}',
  '.dsh-vl-btn{flex:none;width:26px;height:26px;border-radius:6px;border:none;background:transparent;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-brand-primary);transition:background .12s;padding:0}',
  '.dsh-vl-btn:hover{background:color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent)}',
  // 视频 wrapper（含播放按钮 overlay，视觉与输入框视频 tile 一致）
  '.dsh-vl-video-wrap{display:inline-block;position:relative;max-width:' + THUMB_VID + 'px;line-height:0;animation:dsh-vl-fadein .25s ease-out}',
  '.dsh-vl-video-wrap>video{max-width:' + THUMB_VID + 'px;max-height:360px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);display:block;cursor:zoom-in}',
  '.dsh-vl-video-wrap .dsh-vl-play{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:rgba(0,0,0,0.55);border:none;pointer-events:none;color:#fff}',
  // 视频信息行与视频同宽
  '.dsh-vl-video-wrap .dsh-vl-bar{max-width:' + THUMB_VID + 'px}',
  '.dsh-vl-modal{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;cursor:zoom-out;animation:dsh-vl-fadein .18s ease-out forwards}',
  '.dsh-vl-modal img{max-width:92vw!important;max-height:92vh!important;width:auto!important;height:auto!important;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,0.5);cursor:default}',
  '.dsh-vl-modal video{max-width:92vw;max-height:90vh;border-radius:10px;box-shadow:0 8px 40px rgba(0,0,0,0.5)}',
  '@keyframes dsh-vl-fadein{from{opacity:0}to{opacity:1}}',
].join('\n')

function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : a }
function aspectRatio(w: number, h: number): string {
  if (!w || !h) return ''
  const g = gcd(w, h)
  return `${Math.round(w / g)}:${Math.round(h / g)}`
}

function isHttp(src: string): boolean { return /^https?:\/\//i.test(src) }
function isVideoUrl(src: string): boolean { return VIDEO_RE.test(src) }

const REF_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>'
const PLAY_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>'

/** 引用回调：点击引用按钮时由上层（index.ts）写入引用栏。 */
export interface QuoteHandlers {
  /** 引用一张图片（url + 显示名 + 可选尺寸）。 */
  onQuoteImage?: (url: string, name: string, width?: number, height?: number) => void
  /** 引用一个视频（url + 显示名）。 */
  onQuoteVideo?: (url: string, name: string) => void
}

/** 引用图片到对话框（图生图）：下载 → 派发 drop/paste 事件装载进输入框。 */
function refImageToComposer(url: string): void {
  try {
    fetch(url).then((r) => {
      if (!r.ok) throw 0
      return r.blob()
    }).then((blob) => {
      const file = new File([blob], 'reference.png', { type: blob.type || 'image/png' })
      const dt = new DataTransfer()
      dt.items.add(file)
      document.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
      document.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }))
    }).catch(() => {
      void navigator.clipboard.writeText(url)
    })
  } catch {
    void navigator.clipboard.writeText(url)
  }
}

/** 引用视频到对话框（视频延续）：插入 URL 文本 + 复制到剪贴板。 */
function refVideoToComposer(url: string): void {
  const el = document.querySelector('[data-composer-input]')
  if (el) {
    ;(el as HTMLElement).focus()
    try { document.execCommand('insertText', false, url) } catch { /* ignore */ }
  }
  void navigator.clipboard.writeText(url)
}

/** 单例 lightbox（图片 / 视频共用）。 */
let modal: HTMLDivElement | null = null
function closeLightbox(): void {
  if (!modal) return
  if ((modal as any)._onKey) window.removeEventListener('keydown', (modal as any)._onKey)
  const v = modal.querySelector('video')
  if (v) v.pause()
  modal.remove()
  modal = null
}
function openImageLightbox(src: string): void {
  closeLightbox()
  modal = document.createElement('div')
  modal.className = 'dsh-vl-modal'
  ;(modal as any)._onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeLightbox() }
  window.addEventListener('keydown', (modal as any)._onKey)
  const img = document.createElement('img')
  img.src = src
  img.alt = ''
  modal.appendChild(img)
  modal.addEventListener('click', (e) => { if (e.target === modal) closeLightbox() })
  document.body.appendChild(modal)
}
function openVideoLightbox(src: string): void {
  closeLightbox()
  modal = document.createElement('div')
  modal.className = 'dsh-vl-modal'
  ;(modal as any)._onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeLightbox() }
  window.addEventListener('keydown', (modal as any)._onKey)
  const v = document.createElement('video')
  v.src = src
  v.controls = true
  v.playsInline = true
  v.preload = 'metadata'
  modal.appendChild(v)
  modal.addEventListener('click', (e) => { if (e.target === modal) closeLightbox() })
  document.body.appendChild(modal)
}

/** 信息行 + 引用按钮（图片）。 */
function buildImageBar(img: HTMLImageElement, src: string, handlers: QuoteHandlers): HTMLElement {
  const bar = document.createElement('div')
  bar.className = 'dsh-vl-bar'
  bar.dataset.dshVlBar = '1'

  const meta = document.createElement('span')
  meta.className = 'dsh-vl-meta'
  const title = (img.getAttribute('alt') || '').trim()
  const fill = () => {
    const w = img.naturalWidth, h = img.naturalHeight
    if (w && h) {
      const r = aspectRatio(w, h)
      meta.textContent = (title ? title + ' · ' : '') + w + '×' + h + (r ? ' · ' + r : '')
    } else {
      meta.textContent = title
    }
  }
  if (img.complete && img.naturalWidth) fill()
  else img.addEventListener('load', fill, { once: true })
  fill()
  bar.appendChild(meta)

  const spacer = document.createElement('span')
  spacer.style.cssText = 'flex:1;min-width:4px'
  bar.appendChild(spacer)

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'dsh-vl-btn'
  btn.title = '引用此图（图生图 / 分析）'
  btn.innerHTML = REF_SVG
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    if (handlers.onQuoteImage) {
      handlers.onQuoteImage(src, title || '图片', img.naturalWidth || undefined, img.naturalHeight || undefined)
    } else {
      refImageToComposer(src)
    }
  })
  bar.appendChild(btn)

  return bar
}

/** 信息行 + 引用按钮（视频）。 */
function buildVideoBar(title: string, src: string, handlers: QuoteHandlers): HTMLElement {
  const bar = document.createElement('div')
  bar.className = 'dsh-vl-bar'
  bar.dataset.dshVlBar = '1'

  if (title) {
    const meta = document.createElement('span')
    meta.className = 'dsh-vl-meta'
    meta.textContent = title
    bar.appendChild(meta)
  }

  const spacer = document.createElement('span')
  spacer.style.cssText = 'flex:1;min-width:4px'
  bar.appendChild(spacer)

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'dsh-vl-btn'
  btn.title = '引用此视频'
  btn.innerHTML = REF_SVG
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    if (handlers.onQuoteVideo) {
      handlers.onQuoteVideo(src, title || '视频')
    } else {
      refVideoToComposer(src)
    }
  })
  bar.appendChild(btn)

  return bar
}

/** 是否在对话区（只增强对话内容，不碰头像/设置 UI）。 */
function inConversation(el: Element): boolean {
  return !!el.closest('[data-conversation-scroll]')
}

/** 是否是小图标/头像（跳过，避免给头像加信息行）。 */
function isTiny(img: HTMLImageElement): boolean {
  const w = img.getAttribute('width')
  const h = img.getAttribute('height')
  if (w && h && parseInt(w, 10) < 48 && parseInt(h, 10) < 48) return true
  if (img.naturalWidth > 0 && img.naturalWidth < 48) return true
  return false
}

/** 把单个 <img> 增强成图片卡片（幂等）。 */
function enhanceImage(img: HTMLImageElement, handlers: QuoteHandlers): void {
  const src = img.getAttribute('src') || ''
  if (!isHttp(src) || isVideoUrl(src)) return
  if (!inConversation(img)) return
  if (isTiny(img)) return
  // 信息行（已存在则跳过）
  if (img.dataset.dshVlBar === '1') return
  const next = img.nextElementSibling
  if (next && (next as HTMLElement).dataset && (next as HTMLElement).dataset.dshVlBar === '1') return
  img.dataset.dshVlBar = '1'
  img.insertAdjacentElement('afterend', buildImageBar(img, src, handlers))
}

/** 把单个 mp4 <img> 替换成 <video> 播放器卡片（幂等）。 */
function enhanceVideo(img: HTMLImageElement, handlers: QuoteHandlers): void {
  const src = img.getAttribute('src') || ''
  if (!isHttp(src) || !isVideoUrl(src)) return
  if (!inConversation(img)) return
  if (img.dataset.dshVlVideo === '1') return
  img.dataset.dshVlVideo = '1'

  const title = (img.getAttribute('alt') || '').trim()
  const wrapper = document.createElement('span')
  wrapper.className = 'dsh-vl-video-wrap'

  const v = document.createElement('video')
  v.src = src
  v.controls = true
  v.muted = true
  v.playsInline = true
  v.preload = 'metadata'
  v.addEventListener('click', (e) => { e.stopPropagation(); openVideoLightbox(src) })

  wrapper.appendChild(v)

  // 播放按钮 overlay（让用户一眼看出是视频；与输入框 tile 视觉一致）
  const play = document.createElement('span')
  play.className = 'dsh-vl-play'
  play.innerHTML = PLAY_SVG
  wrapper.appendChild(play)

  wrapper.appendChild(buildVideoBar(title, src, handlers))
  img.replaceWith(wrapper)
}

function scan(handlers: QuoteHandlers): void {
  if (!document.body) return
  const imgs = document.querySelectorAll('[data-conversation-scroll] img')
  for (let i = 0; i < imgs.length; i++) {
    const img = imgs[i] as HTMLImageElement
    if (img.closest('.dsh-vl-modal')) continue
    const src = img.getAttribute('src') || ''
    if (isVideoUrl(src)) enhanceVideo(img, handlers)
    else enhanceImage(img, handlers)
  }
}

let scanTimer: number | null = null
function debouncedScan(handlers: QuoteHandlers): void {
  if (scanTimer !== null) window.clearTimeout(scanTimer)
  scanTimer = window.setTimeout(() => {
    scanTimer = null
    scan(handlers)
  }, 200)
}

/** 启动渲染增强器，返回清理函数。 */
export function applyRenderEnhancer(handlers: QuoteHandlers = {}): () => void {
  const style = document.createElement('style')
  style.dataset.plugin = 'dsh-verylook-render'
  style.textContent = CSS
  document.head.appendChild(style)

  // 点击委托（capture 阶段，确保在 DSH 自己的监听之前拿到事件）
  const onClick = (e: MouseEvent): void => {
    if (modal) return
    const t = e.target as HTMLElement
    if (!t || !t.closest) return
    const img = t.tagName === 'IMG' ? (t as HTMLImageElement) : (t.closest('img') as HTMLImageElement | null)
    if (!img) return
    const src = img.getAttribute('src') || ''
    if (!isHttp(src)) return
    if (isVideoUrl(src)) {
      // 视频已被替换成 <video>，点击由 <video> 自身处理；这里兜底防漏
      return
    }
    if (!inConversation(img)) return
    if (isTiny(img)) return
    e.preventDefault()
    e.stopPropagation()
    openImageLightbox(src)
  }
  document.addEventListener('click', onClick, true)

  scan(handlers)
  const mo = new MutationObserver(() => debouncedScan(handlers))
  mo.observe(document.body, { childList: true, subtree: true })
  const timer = window.setInterval(() => scan(handlers), 3000)

  return () => {
    document.removeEventListener('click', onClick, true)
    mo.disconnect()
    window.clearInterval(timer)
    if (scanTimer !== null) window.clearTimeout(scanTimer)
    style.remove()
    closeLightbox()
  }
}