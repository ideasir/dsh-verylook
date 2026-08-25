/**
 * SessionHeaderCopyButton — a small icon in the session header's action row
 * that copies the session reference `dsh-session://<id>` to the clipboard.
 * Rendered via `conversation.session.header.actions` (order=-100).
 *
 * After mount, we physically move the DOM node into the titleCluster (before
 * the breadcrumbs), so it appears LEFT of the session title instead of in
 * the right-side actions row. This avoids React virtual-DOM conflicts
 * because we only move an element that the slot system created — we never
 * mutate React-owned nodes.
 */
import { useState, useEffect, useRef } from 'react'

export interface SessionHeaderCopyButtonProps {
  sessionId: string
  useSessions: <T>(selector: (s: { byId: Record<string, { title?: string }> }) => T) => T
}

export function SessionHeaderCopyButton({ sessionId, useSessions }: SessionHeaderCopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const buttonRef = useRef<HTMLSpanElement>(null)

  const displayTitle = useSessions((s) => s.byId[sessionId]?.title ?? '')

  useEffect(() => {
    const btn = buttonRef.current
    if (!btn) return
    // Find the header → titleCluster → insert before crumbs
    const header = btn.closest('header') as HTMLElement | null
    if (!header) return
    // titleCluster: first flex child group containing the breadcrumb nav
    const titleCluster = header.querySelector('[class*="titleCluster"]') as HTMLElement | null
    if (!titleCluster) return
    const crumbs = titleCluster.querySelector('[class*="crumbs"]') as HTMLElement | null
    if (crumbs) {
      titleCluster.insertBefore(btn, crumbs)
    } else {
      titleCluster.appendChild(btn)
    }
    // Remove from its original slot container (headerActions)
    const actions = btn.closest('[class*="headerActions"]') as HTMLElement | null
    if (actions) actions.removeChild(btn)
  }, [])

  const handleClick = () => {
    if (copied) return
    const ref = `dsh-session://${sessionId}`
    const text = displayTitle ? `${ref}\n标题: ${displayTitle}` : ref
    void navigator.clipboard?.writeText?.(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.cssText = 'position:fixed;left:-9999px'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { /* ignore */ }
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <span
      ref={buttonRef}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: 6,
        cursor: 'pointer',
        color: 'var(--dsw-alias-label-tertiary)',
        background: 'transparent',
        border: 'none',
        padding: 0,
        transition: 'background .15s, color .15s',
        flexShrink: 0,
        marginRight: 6,
      }}
      title={copied ? '已复制' : '复制会话ID'}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--dsw-alias-bg-hover)'
        e.currentTarget.style.color = 'var(--dsw-alias-label-primary)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--dsw-alias-label-tertiary)'
      }}
    >
      {copied
        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
      }
    </span>
  )
}