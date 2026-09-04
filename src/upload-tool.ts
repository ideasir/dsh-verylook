/**
 * dsh-verylook/upload-tool — the `verylook_upload_image` tool.
 *
 * 把本地图片文件（或 base64）上传到 Cloudflare R2（r2-very-im bucket），
 * 返回绑定域名 r2.very.im 的公网 URL。技能出图拿到 base64、或图生图需要
 * 公网参考图时都用它：
 *
 *   1. UmFun/Agnes API 只回 base64 时 → 解码上传 → 公网 URL → 写 ![标题](url) 渲染
 *   2. 图生图需要传参考图给上游 → 上传本地图 → 公网 URL → 传给上游（不给 base64）
 *
 * 凭据（环境变量，均有默认值，无需配置即可用）：
 * - VERYLOOK_R2_TOKEN      Cloudflare API Token（需 R2 Object Write 权限）
 * - VERYLOOK_R2_ACCOUNT    Cloudflare Account ID
 * - VERYLOOK_R2_BUCKET     R2 bucket 名（默认 r2-very-im）
 * - VERYLOOK_R2_DOMAIN     绑定的公开域名（默认 r2.very.im）
 */

import { readFile } from 'node:fs/promises'
import * as path from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { VerylookScope } from './settings.ts'
import { verylookEnabled } from './settings.ts'

// ── Configuration ──

/** R2 上传配置：环境变量优先，其次读取本地配置文件（不入库）。
 * R2 凭据属于密钥，绝不硬编码进源码。配置文件：
 *   ~/.dsh/verylook-r2.json  { "token": "...", "account": "...", "bucket": "r2-very-im", "domain": "r2.very.im" }
 */
function r2Config() {
  let file: { token?: string; account?: string; bucket?: string; domain?: string } = {}
  try {
    const fs = require('node:fs')
    const os = require('node:os')
    const p = require('node:path')
    const raw = fs.readFileSync(p.join(os.homedir(), '.dsh', 'verylook-r2.json'), 'utf-8')
    file = JSON.parse(raw)
  } catch { /* 配置文件缺失时仅用环境变量 */ }
  return {
    token: process.env.VERYLOOK_R2_TOKEN ?? file.token ?? '',
    account: process.env.VERYLOOK_R2_ACCOUNT ?? file.account ?? '',
    bucket: process.env.VERYLOOK_R2_BUCKET ?? file.bucket ?? 'r2-very-im',
    domain: process.env.VERYLOOK_R2_DOMAIN ?? file.domain ?? 'r2.very.im',
  }
}

// ── Upload logic ──

/** 上传一个 buffer 到 R2，返回公网 URL。文件名 = vl_<时间戳>_<随机>.<ext>。 */
export async function uploadToR2(data: Uint8Array, ext: string): Promise<string> {
  const { token, account, bucket, domain } = r2Config()
  if (token === '' || account === '') throw new Error('R2 凭据未配置：请设置环境变量 VERYLOOK_R2_TOKEN/VERYLOOK_R2_ACCOUNT，或写入 ~/.dsh/verylook-r2.json')
  const stamp = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  const name = `vl_${stamp}_${rand}.${ext}`

  const url = `https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${bucket}/objects/${encodeURIComponent(name)}`
  const resp = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': ext === 'jpg' ? 'image/jpeg' : `image/${ext}`,
    },
    body: Buffer.from(data),
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`R2 上传失败 HTTP ${resp.status}：${text.slice(0, 200)}`)
  }
  return `https://${domain}/${name}`
}

/** 从扩展名推断 MIME（jpg 特判 jpeg）。 */
function normalizeExt(input: string): string {
  const ext = (input.split('.').pop() ?? 'png').toLowerCase()
  if (ext === 'jpeg') return 'jpg'
  if (ext === 'png' || ext === 'jpg' || ext === 'webp' || ext === 'gif') return ext
  return 'png'
}

// ── Tool definition ──

/** Register the verylook_upload_image tool. */
export function registerUploadTool(ctx: Context, features: VerylookScope): void {
  ctx.tools.register(defineTool({
    name: 'verylook_upload_image',
    description: [
      '把本地图片上传到图床（Cloudflare R2），返回可直接访问的公网 URL。',
      '',
      '两个用途：',
      '1. 出图 API 只返回 base64 时：把 base64 传给本工具，拿到公网 URL 后在最终回复里写 ![标题](URL) 渲染图片。',
      '2. 图生图/多图合成：把用户的本地图片上传，把返回的公网 URL 传给上游 API（不要给 base64，更快更稳）。',
      '',
      '注意：最终回复必须用 ![标题](URL) 包裹 URL 才能渲染成图片。',
    ].join('\n'),
    parameters: {
      path: {
        type: 'string',
        description: '本地图片文件绝对路径（path 与 base64 二选一）。扩展名决定输出格式（png/jpg/webp/gif）。',
      },
      base64: {
        type: 'string',
        description: '图片的 base64 内容（不带 data: 前缀；path 与 base64 二选一）。',
      },
      ext: {
        type: 'string',
        description: "图片格式（base64 方式时必填）：'png' | 'jpg' | 'webp' | 'gif'，默认 'png'。",
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          url: { type: 'string' },
          error: { type: 'string' },
        },
      },
      render: (_args: unknown, value: { ok: boolean; url?: string; error?: string }) =>
        value.ok && value.url
          ? [{ type: 'text', text: `公网 URL：${value.url}` }]
          : [{ type: 'text', text: `上传失败：${value.error ?? '未知错误'}` }],
    },
    isConcurrencySafe: () => true,
    async execute(args: { path?: unknown; base64?: unknown; ext?: unknown }) {
      try {
        if (!verylookEnabled(features)) return { ok: false, error: 'VeryLook 已关闭' }

        const filePath = typeof args.path === 'string' && args.path.trim() !== '' ? args.path.trim() : ''
        const b64 = typeof args.base64 === 'string' && args.base64.trim() !== '' ? args.base64.trim() : ''
        const extHint = typeof args.ext === 'string' && args.ext.trim() !== '' ? args.ext.trim() : 'png'

        let data: Uint8Array
        let ext: string

        if (filePath !== '') {
          const file = path.resolve(filePath)
          ext = normalizeExt(file)
          data = new Uint8Array(await readFile(file))
        } else if (b64 !== '') {
          ext = normalizeExt(extHint)
          // 兼容 data: URI 前缀
          const clean = b64.replace(/^data:[^;]+;base64,/, '')
          data = new Uint8Array(Buffer.from(clean, 'base64'))
        } else {
          return { ok: false, error: 'path 与 base64 必须提供一个' }
        }

        if (data.length === 0) return { ok: false, error: '图片内容为空' }
        if (data.length > 50 * 1024 * 1024) return { ok: false, error: '图片超过 50MB 上限' }

        const url = await uploadToR2(data, ext)
        return { ok: true, url }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    },
  }))
}
