/**
 * dsh-verylook — "look at anything" for DeepSeek Harness.
 *
 * Host plugin. A single master switch (`verylook.enabled`) controls the whole
 * plugin:
 * - ON (default): every capability is enabled. Images / videos / archives /
 *   documents are routed through the plugin's own file channel (upload into
 *   the session `.uploads/`, the model sees only the path, then calls
 *   `verylook_see`), so the api-proxy's native "model does not support image
 *   input" check is never reached — no request rewriting, no admission
 *   override, no harness patch.
 * - OFF: the plugin is dormant — nothing is intercepted, the see tool answers
 *   "已关闭", and DSH behaves exactly as if the plugin were absent.
 *
 * Plugin-owned settings are read and written through the authorized
 * `remote.verylook` RPC namespace. They are deliberately NOT registered as
 * configurable LLM providers, because rc.6 renders every such entry in the
 * global model-provider picker. No `WEB_SETTINGS_NAMESPACES` patch.
 *
 * Upload / model discovery / env check are Remote RPCs on the
 * `verylook` wire namespace (Typert), so they inherit the api-proxy
 * connection authorization instead of exposing unauth'd HTTP routes.
 *
 * All registrations are effects: unloading the plugin removes the settings
 * namespaces, the routes, and every disposer.
 */

import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { Config, VerylookConfig, AudioConfig, verylookEnabled, type VisionSettings, type VisionScope, type VerylookScope, type AudioScope } from './settings.ts'
import { registerSeeTool } from './see-tool.ts'
import { registerZipTool } from './zip-tool.ts'
import { registerUploadTool } from './upload-tool.ts'
import { VerylookRemoteService } from './remote.ts'
import { VERYLOOK_SKILL } from './verylook-skill.ts'
import type {} from './types.ts'

export { Config } from './settings.ts'
export { VerylookConfig } from './settings.ts'
export { AudioConfig } from './settings.ts'
export type { VisionProviderConfig, VisionSettings, VisionScope, VerylookSettings, VerylookScope, AudioProviderConfig, AudioSettings, AudioScope } from './settings.ts'
export type { DescribeImageInput, DescribeResult } from './vision-client.ts'
export { describeImages, statusMessage } from './vision-client.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'verylook'

/** Required services: settings, llm, sessions, credentials, tools, systemPrompt, fs. */
export const inject = ['settings', 'llm', 'sessions', 'credentials', 'tools', 'systemPrompt', 'fs']

/**
 * Plugin body: register the feature toggles + vision/audio settings
 * namespaces, expose their private settings RPCs, register the unified
 * verylook_see / process_zip tools, the upload RPC.
 */
export function apply(ctx: Context, config: VisionSettings): void {
  // Feature master switches (settings page → plugin area).
  const features: VerylookScope = ctx.settings.register(settingsNamespace('verylook'), VerylookConfig, { base: undefined })
  const scope: VisionScope = ctx.settings.register(settingsNamespace('vision'), Config, { base: config })
  // Audio model (L2+L3 merged): API providers; primary + fallback.
  const audioScope: AudioScope = ctx.settings.register(settingsNamespace('verylook-audio'), AudioConfig, { base: undefined })

  // Plugin-owned settings are served through the private remote.verylook RPCs
  // below. Do NOT register them as configurable LLM providers: rc.6 exposes
  // every such entry in the global model-provider picker, which makes plugin
  // settings appear as fake models.

  // Master switch: one switch controls the whole plugin (ON = all features,
  // OFF = dormant, harness behaves as without it). The see tool answers
  // "已关闭" when OFF; client interception is gated by the same flag.

  // Host receiver for the client.s RPCs (model discovery, upload,
  // session modality, env check). All ride the authorized api-proxy connection.
  ctx.plugin(VerylookRemoteService)

  // The unified "look at anything" tool (image / video / zip / document branches).
  registerSeeTool(ctx, scope, audioScope, features)

  // Tell the main model how to see content and how uploads land.
  ctx.systemPrompt.section({
    name: 'verylook:vision',
    order: 200,
    text: VERYLOOK_SKILL,
  })

  // ZIP extraction tool (vendored from dsh-zip): extract operation only —
  // the "look at zip contents" branch lives in verylook_see.
  registerZipTool(ctx)

  // R2 image-hosting tool: base64/local file → public URL (renders + img2img).
  registerUploadTool(ctx, features)
}
