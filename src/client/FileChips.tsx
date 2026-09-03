/**
 * FileChips: pending upload attachments rendered in the composer card
 * (input.attachments slot), matching the native attachment rail look:
 * - Images: 64px rounded thumbnail, click opens lightbox
 * - Videos: 64px rounded thumbnail with play icon
 * - Other files: 64px rounded icon tile
 * - 18px circular remove button on hover (top-right)
 */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { PendingFilesController, PendingFilesState } from './pending-files.ts'
import { formatSize } from './upload-shared.ts'
import { FileTypeIcon } from './FileTypeIcon.tsx'
import { ImageLightbox, type ImageLightboxLabels } from './lightbox.tsx'
import { VideoPlayer } from './video-player.tsx'
import type { QuoteStore, QuoteItem } from './quote-store.ts'

/** Injected face supplied by the plugin apply closure. */
export interface FileChipsInjected {
  t: TranslateNS<'verylook'>
  pending: PendingFilesController
  usePending: (selector: (state: PendingFilesState) => unknown) => unknown
  sessionId: string
  /** Quote store for the reference bar above the input. */
  quotes: QuoteStore
}

const VIDEO_EXT_RE = /\.(mp4|mov|avi|mkv|webm|flv|wmv|m4v|mpg|mpeg)$/i

function isVideoName(name: string): boolean {
  return VIDEO_EXT_RE.test(name)
}

/** Match native rail tile size (64px). */
const CHIP_SIZE = 64

const LIGHTBOX_LABELS: ImageLightboxLabels = { dialog: '图片预览', close: '关闭预览' }

export function FileChips(props: FileChipsInjected) {
  const { pending, usePending, sessionId, quotes } = props
  const files = usePending((state: PendingFilesState) => state[sessionId]) as
    | ReturnType<PendingFilesController['get']>
    | undefined
  const list = files ?? []
  // Quote bar above the input: subscribe to the quote store so quotes added
  // via the thumbnail "quote" button appear immediately (and stay live even
  // when there are no attachment chips).
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>(() => quotes.get(sessionId))
  useEffect(() => quotes.subscribe(() => {
    setQuoteItems(quotes.get(sessionId))
  }), [sessionId, quotes])
  const previewUrls = useRef(new Set<string>())
  const [playingUrl, setPlayingUrl] = useState<string | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const dragDepth = useRef(0)

  // Full-viewport drop overlay while a file drag is over the page.
  useEffect(() => {
    const hasFiles = (e: DragEvent): boolean =>
      e.dataTransfer !== null && e.dataTransfer.types.includes('Files')
    const onDragEnter = (e: DragEvent): void => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragDepth.current += 1
      setDragActive(true)
    }
    const onDragOver = (e: DragEvent): void => {
      if (!hasFiles(e)) return
      e.preventDefault()
    }
    const onDragLeave = (e: DragEvent): void => {
      if (!hasFiles(e)) return
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (dragDepth.current === 0) setDragActive(false)
    }
    const onDrop = (e: DragEvent): void => {
      if (!hasFiles(e)) return
      dragDepth.current = 0
      setDragActive(false)
    }
    const reset = (): void => {
      dragDepth.current = 0
      setDragActive(false)
    }
    document.addEventListener('dragenter', onDragEnter, true)
    document.addEventListener('dragover', onDragOver, true)
    document.addEventListener('dragleave', onDragLeave, true)
    document.addEventListener('drop', onDrop, true)
    window.addEventListener('dragend', reset)
    return () => {
      document.removeEventListener('dragenter', onDragEnter, true)
      document.removeEventListener('dragover', onDragOver, true)
      document.removeEventListener('dragleave', onDragLeave, true)
      document.removeEventListener('drop', onDrop, true)
      window.removeEventListener('dragend', reset)
    }
  }, [])

  useEffect(() => {
    const current = new Set(list.map(file => file.previewUrl).filter((url): url is string => url !== undefined))
    for (const url of previewUrls.current) {
      if (!current.has(url)) URL.revokeObjectURL(url)
    }
    previewUrls.current = current
  }, [list])
  useEffect(() => () => {
    for (const url of previewUrls.current) URL.revokeObjectURL(url)
  }, [])

  const hasQuotes = quoteItems.length > 0
  if (list.length === 0 && !dragActive && !hasQuotes) return null

  return (
    <>
    <style>{`@keyframes verylook-spin { to { transform: rotate(360deg); } }`}</style>
    <style>{`@keyframes verylook-fade-in { from { opacity: 0; } to { opacity: 1; } }`}</style>
    {dragActive && createPortal(
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--dsw-alias-bg-mask-drop)',
          backdropFilter: 'blur(10px)',
          animation: 'verylook-fade-in .16s ease-out',
          pointerEvents: 'none',
        }}
        role="status"
      >
        <div style={{ textAlign: 'center', marginTop: '-3%', padding: '0 40px' }}>
          <svg width="115" height="84" viewBox="0 0 115 84" fill="none" aria-hidden="true">
            <g clipPath="url(#verylookDropClip)">
              <rect y="17.0742" width="44.1832" height="43.6431" rx="12" transform="rotate(-22.7338 0 17.0742)" fill="var(--dsw-alias-brand-primary)" opacity="0.3" />
              <rect x="73.4043" y="8.54297" width="43.7267" height="50.5284" rx="8" transform="rotate(17.403 73.4043 8.54297)" fill="var(--dsw-alias-brand-primary)" opacity="0.5" />
              <path d="M30.4917 28.1369L40.8865 33.4564L37.2232 34.9524L29.5302 31.0159L26.7919 39.2122L23.1285 40.7082L26.8287 29.6338L16.8967 24.5516L20.5601 23.0556L27.7902 26.7549L30.3639 19.052L34.0273 17.556L30.4917 28.1369Z" fill="white" />
              <path d="M77.5088 26.3047L101.057 33.7966" stroke="white" strokeWidth="3" />
              <path d="M72.2646 42.7871L86.3938 47.2823" stroke="white" strokeWidth="3" />
              <path d="M74.8867 34.5469L98.4353 42.0388" stroke="white" strokeWidth="3" />
            </g>
            <defs>
              <clipPath id="verylookDropClip">
                <rect width="115" height="84" rx="8" fill="white" />
              </clipPath>
            </defs>
          </svg>
          <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--dsw-alias-label-primary)', marginTop: 16 }}>
            松开以添加文件
          </div>
          <div style={{ fontSize: 14, color: 'var(--dsw-alias-label-tertiary)', marginTop: 16, whiteSpace: 'pre-wrap' }}>
            支持图片、视频、压缩包、文档等
          </div>
        </div>
      </div>,
      document.body,
    )}
    {list.length > 0 && (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        padding: '8px 12px',
      }}
    >
      {list.map((file) => (
        <span
          key={file.id}
          style={{ flex: '0 0 64px', width: 64, height: 64, position: 'relative' }}
          onMouseEnter={() => setHoveredId(file.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          <span
            style={{
              display: 'block',
              width: 64,
              height: 64,
              borderRadius: 16,
              border: '1px solid var(--dsw-alias-border-l2)',
              background: 'var(--dsw-alias-bg-layer-2)',
              overflow: 'hidden',
              position: 'relative',
              cursor: file.previewUrl !== undefined && file.uploading !== true ? 'pointer' : 'default',
            }}
            onClick={() => {
              if (file.uploading === true || file.previewUrl === undefined) return
              if (isVideoName(file.name)) {
                setPlayingUrl(file.previewUrl)
              } else {
                setLightboxSrc(file.previewUrl)
              }
            }}
          >
            {file.uploading === true ? (
              <span style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
              }}>
                <svg width="100%" height="100%" viewBox="0 0 28 28" fill="none" aria-hidden="true" style={{ position: 'absolute', animation: 'verylook-spin 0.8s linear infinite' }}>
                  <circle cx="14" cy="14" r="11" stroke="var(--dsw-alias-border-l3)" strokeWidth="2.5" />
                  <circle cx="14" cy="14" r="11" stroke="var(--dsw-alias-brand-primary)" strokeWidth="2.5" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 11}`}
                    strokeDashoffset={`${2 * Math.PI * 11 * (1 - (file.progress ?? 0) / 100)}`}
                    transform="rotate(-90 14 14)" />
                </svg>
                <span style={{ fontSize: 9, lineHeight: 1, fontWeight: 600, color: 'var(--dsw-alias-label-secondary)' }}>
                  {file.progress ?? 0}%
                </span>
              </span>
            ) : file.previewUrl !== undefined ? (
              isVideoName(file.name) ? (
                <>
                  <video src={file.previewUrl} preload="metadata" muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {/* Play icon overlay: 40px circle with triangle */}
                  <span
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      background: 'rgba(0,0,0,0.55)',
                      border: 'none',
                      pointerEvents: 'none',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                </>
              ) : (
                <img src={file.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )
            ) : (
              <span style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                background: 'var(--dsw-alias-bg-layer-1)',
                color: 'var(--dsw-alias-brand-primary)',
              }}>
                <FileTypeIcon name={file.name} size={36} />
              </span>
            )}
          </span>
          {/* Close × on hover (18px circular, native look) */}
          <button
            type="button"
            aria-label={`移除: ${file.name}`}
            onClick={(e) => { e.stopPropagation(); pending.remove(sessionId, file.id) }}
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              zIndex: 1,
              display: 'grid',
              placeItems: 'center',
              width: 18,
              height: 18,
              border: 'none',
              borderRadius: '50%',
              background: 'var(--dsw-alias-button-contrast-fill)',
              color: 'var(--dsw-alias-label-primary-inverted)',
              cursor: 'pointer',
              padding: 0,
              opacity: hoveredId === file.id ? 1 : 0,
              transition: 'opacity .2s ease-in-out',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {/* Tooltip on hover */}
          {hoveredId === file.id && file.uploading !== true && (
            <span
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 6px)',
                left: '50%',
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap',
                fontSize: 11,
                lineHeight: '16px',
                color: 'var(--dsw-alias-label-primary)',
                background: 'var(--dsw-alias-bg-layer-2)',
                border: '1px solid var(--dsw-alias-border-l2)',
                borderRadius: 6,
                padding: '3px 8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                zIndex: 10,
                pointerEvents: 'none',
              }}
            >
              {file.previewUrl !== undefined && isVideoName(file.name)
                ? formatSize(file.size)
                : file.previewUrl !== undefined
                  ? `${file.size > 0 ? formatSize(file.size) : file.name}`
                  : `${file.name} · ${formatSize(file.size)}`}
            </span>
          )}
        </span>
      ))}
    </div>
    )}
    {lightboxSrc !== null && (
      <ImageLightbox src={lightboxSrc} alt="" labels={LIGHTBOX_LABELS} onClose={() => setLightboxSrc(null)} />
    )}
    {playingUrl !== null && (
      <VideoPlayer src={playingUrl} onClose={() => { setPlayingUrl(null); URL.revokeObjectURL(playingUrl) }} />
    )}
    {hasQuotes && (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          padding: '6px 8px 4px 12px',
          borderBottom: '1px solid var(--dsw-alias-border-l1)',
          background: 'var(--dsw-alias-bg-layer-2)',
          borderRadius: '12px 12px 0 0',
          animation: 'verylook-fade-in .18s ease-out',
        }}
      >
        {quoteItems.map((q) => (
          <span
            key={q.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 4px 2px 8px',
              borderRadius: 6,
              background: 'var(--dsw-alias-bg-layer-3)',
              border: '1px solid var(--dsw-alias-border-l2)',
              fontSize: 12,
              lineHeight: '20px',
              color: 'var(--dsw-alias-label-secondary)',
              maxWidth: 280,
              overflow: 'hidden',
            }}
          >
            <span style={{
              flex: 'none',
              fontWeight: 600,
              color: 'var(--dsw-alias-brand-primary)',
              whiteSpace: 'nowrap',
            }}>
              {q.kind === 'image' ? '图片' : '视频'}
            </span>
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}>
              {q.name}
            </span>
            <button
              type="button"
              aria-label="移除引用"
              onClick={(e) => { e.stopPropagation(); quotes.remove(sessionId, q.id) }}
              style={{
                flex: 'none',
                display: 'grid',
                placeItems: 'center',
                width: 16,
                height: 16,
                border: 0,
                borderRadius: 4,
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--dsw-alias-label-tertiary)',
                padding: 0,
                transition: 'background .12s, color .12s',
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </span>
        ))}
      </div>
    )}
    </>
  )
}