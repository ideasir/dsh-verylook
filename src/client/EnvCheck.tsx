/**
 * EnvCheckDialog — the "环境检测" modal opened from the verylook plugin card.
 * Runs the host environment self-check (Python / ffmpeg / yt-dlp / yt-dlp)
 * and lists every item with status. Repairable items show a "一键修复" button
 * that calls the host repair RPC and refreshes that item's state.
 */

import { useEffect, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { EnvCheckItem, EnvCheckReport } from './upload-shared.ts'

/** Injected face supplied by the plugin card. */
export interface EnvCheckInjected {
  t: TranslateNS<'verylook'>
  envCheck: () => Promise<EnvCheckReport>
  envRepair: (action: 'install-yt-dlp') => Promise<EnvCheckItem>
}

const css = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 2147483000,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    boxSizing: 'border-box' as const,
    width: 'min(560px, 92vw)',
    maxHeight: '80vh',
    overflow: 'auto',
    background: 'var(--dsw-alias-bg-layer-2)',
    border: '1px solid var(--dsw-alias-border-l2)',
    borderRadius: 14,
    boxShadow: '0 18px 50px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 14,
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    position: 'sticky' as const, top: 0, zIndex: 1,
    background: 'var(--dsw-alias-bg-layer-2)',
    padding: '14px 16px', margin: '-18px -20px 0',
    borderBottom: '1px solid var(--dsw-alias-border-l1)',
  },
  headerTitle: { display: 'flex', alignItems: 'center', gap: 8 },
  title: { margin: 0, fontSize: 15, lineHeight: '24px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
  body: { padding: '0 16px', display: 'flex', flexDirection: 'column' as const, gap: 14 },
  summary: { margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-label-tertiary)' },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '10px 12px',
    border: '1px solid var(--dsw-alias-border-l1)',
    borderRadius: 10,
    background: 'var(--dsw-alias-bg-layer-1)',
  },
  itemHead: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
  dot: { width: 8, height: 8, borderRadius: 999, flex: 'none', marginTop: 6 },
  itemLabel: { fontSize: 13, lineHeight: '20px', fontWeight: 500, color: 'var(--dsw-alias-label-primary)' },
  itemDetail: { fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)', marginTop: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  guidance: { fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-secondary)', marginTop: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  itemBody: { flex: 1, minWidth: 0 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--dsw-alias-border-l1)', paddingTop: 12, marginBottom: 2 },
} as const

function statusColor(status: 'ok' | 'missing' | 'error'): string {
  if (status === 'ok') return 'var(--dsw-alias-state-success-primary)'
  if (status === 'error') return 'var(--dsw-alias-state-error-primary)'
  return 'var(--dsw-alias-state-warn-primary)'
}

function statusText(status: 'ok' | 'missing' | 'error'): string {
  if (status === 'ok') return '正常'
  if (status === 'error') return '异常'
  return '缺失'
}

/** One check row with its repair button. */
function CheckItemRow({ item, repairing, onRepair }: {
  item: EnvCheckItem
  repairing: boolean
  onRepair: (item: EnvCheckItem) => void
}) {
  return (
    <div style={css.item}>
      <span style={{ ...css.dot, background: statusColor(item.status) }} />
      <div style={css.itemBody}>
        <div style={css.itemHead}>
          <span style={css.itemLabel}>{item.label}</span>
          <span style={{ fontSize: 12, lineHeight: '18px', color: statusColor(item.status) }}>{statusText(item.status)}</span>
        </div>
        <div style={css.itemDetail}>{item.detail}</div>
        {item.guidance !== undefined && item.guidance !== '' && item.status !== 'ok' && (
          <div style={css.guidance}>{item.guidance}</div>
        )}
        {item.repairable && item.status !== 'ok' && item.repairAction !== undefined && (
          <div style={css.actions}>
            <button
              type="button"
              disabled={repairing}
              onClick={() => onRepair(item)}
              style={{
                fontSize: 12, lineHeight: '18px', fontWeight: 500,
                color: 'var(--dsw-alias-label-secondary)',
                background: 'var(--dsw-alias-bg-layer-1)',
                border: '1px solid var(--dsw-alias-border-l2)',
                borderRadius: 8, padding: '4px 12px', cursor: repairing ? 'default' : 'pointer',
                opacity: repairing ? 0.6 : 1, whiteSpace: 'nowrap',
                transition: 'color .12s ease, border-color .12s ease, background .12s ease',
              }}
              onMouseEnter={(e) => { if (repairing) return; e.currentTarget.style.color = 'var(--dsw-alias-brand-primary)'; e.currentTarget.style.borderColor = 'var(--dsw-alias-brand-primary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--dsw-alias-label-secondary)'; e.currentTarget.style.borderColor = 'var(--dsw-alias-border-l2)' }}
            >
              {repairing ? '修复中…' : '一键修复'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** The environment-check modal. */
export function EnvCheckDialog(props: EnvCheckInjected & { onClose: () => void }) {
  const { t, envCheck, envRepair, onClose } = props
  const [report, setReport] = useState<EnvCheckReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [repairing, setRepairing] = useState<string | null>(null)

  const refresh = async (): Promise<void> => {
    setError(null)
    try {
      setReport(await envCheck())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => { void refresh() }, [envCheck])

  const repair = async (item: EnvCheckItem): Promise<void> => {
    if (item.repairAction === undefined) return
    setRepairing(item.id)
    try {
      const fresh = await envRepair(item.repairAction)
      // Replace the repaired item in the current report.
      setReport(current => current === null
        ? null
        : { ...current, items: current.items.map(i => i.id === fresh.id ? fresh : i) })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRepairing(null)
    }
  }

  return (
    <div style={css.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={css.dialog} role="dialog" aria-modal="true" aria-label={t('env.dialogTitle')}>
        <div style={css.header}>
          <span style={css.headerTitle}>
            <h2 style={css.title}>{t('env.dialogTitle')}</h2>
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', color: 'var(--dsw-alias-label-secondary)', cursor: 'pointer', display: 'inline-flex', padding: 4 }}
          ><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div style={css.body}>
          {report !== null && <p style={css.summary}>{report.summary}</p>}
          {error !== null && <p style={{ margin: 0, fontSize: 13, color: 'var(--dsw-alias-state-error-primary)' }}>{error}</p>}
          {report !== null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {report.items.map(item => (
                <CheckItemRow key={item.id} item={item} repairing={repairing === item.id} onRepair={repair} />
              ))}
            </div>
          )}
          {report === null && error === null && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--dsw-alias-label-tertiary)' }}>{t('env.checking')}</p>
          )}
          <div style={css.footer}>
            <button
              type="button"
              onClick={() => void refresh()}
              style={{
                fontSize: 13, lineHeight: '18px', fontWeight: 500,
                color: 'var(--dsw-alias-label-secondary)',
                background: 'var(--dsw-alias-bg-layer-1)',
                border: '1px solid var(--dsw-alias-border-l2)',
                borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                transition: 'color .12s ease, border-color .12s ease, background .12s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--dsw-alias-brand-primary)'; e.currentTarget.style.borderColor = 'var(--dsw-alias-brand-primary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--dsw-alias-label-secondary)'; e.currentTarget.style.borderColor = 'var(--dsw-alias-border-l2)' }}
            >{t('env.refresh')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
