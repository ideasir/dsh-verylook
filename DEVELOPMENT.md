# dsh-verylook 开发文档

> **UI 规范：** 图标（Lucide 24×24 stroke-2）、主题（CSS 变量）、卡片结构（dsh-mm-*）统一遵循
> `/vol1/1000/DeepSeek/DSH-UI-SPEC.md` —— 所有 ideasir 插件必须遵守，禁止硬编码颜色/非标准图标。

## 1. 项目结构

```text
src/
├── index.ts                 # Host 半部：工具注册、RPC、上传、解析路由
├── client/                  # Client 半部：插件 UI
│   ├── index.ts             # 入口：注册 settings.plugin.item 卡片、眼睛开关
│   ├── PluginTab.tsx        # VeryLook 配置卡片
│   ├── VisionSettings.tsx   # 视觉模型设置
│   ├── Features.tsx         # 功能开关（识别图像/视频）
│   ├── EnvCheck.tsx         # 环境自检
│   ├── ChatMinimap.ts       # 右侧对话导航标尺
│   ├── SessionHeaderCopyButton.tsx  # 会话 Header 复制按钮
│   ├── eye-controller.ts    # 眼睛开关控制器
│   └── ...                  # 其他 UI 组件
├── parser/                  # 文档解析器（PDF/Word/Excel/PPT/PSD/ZIP）
├── see-tool.ts              # verylook_see 工具
├── describe-tool.ts         # 图片描述工具
├── doc-tool.ts              # 文档解析工具
├── video-tool.ts            # 视频理解工具
├── zip-tool.ts              # 压缩包工具
└── ...
lib/                         # 构建产物（lib/index.js + lib/client.js）
scripts/copy-worker.mjs      # 复制 PDF worker
skills/verylook/SKILL.md     # 技能定义
```

运行时使用 `lib/` 构建产物。`src/` 是唯一源码，修改后必须重新构建。

## 2. 环境要求

- Node.js 20+；
- npm；
- DSH 相关依赖（`@deepseek-ai/dsh-api-remotes`、`@deepseek-ai/dsh-host-apiproxy` 等）；
- `pdfjs-dist`、`psd.js`、`adm-zip`、`fflate`、`fast-xml-parser`、`pngjs` 等解析依赖。

## 3. 构建

```bash
npm install
npm run build
```

`build` 等价于：

```bash
tsc -p tsconfig.json                          # 编译 Host 半部
tsc -p tsconfig.client.json --emitDeclarationOnly
tsdown                                        # 构建浏览器 bundle
node scripts/copy-worker.mjs                  # 复制 PDF worker
```

类型检查：

```bash
npm run typecheck
```

## 4. Host 半部设计

`src/index.ts` 负责：

1. 注册 `verylook_see` 工具（统一入口：图片/视频/音频/文档/压缩包/聊天记录）；
2. 注册视觉/音频模型配置 namespace（`vision` / `verylook-audio`）；
3. 通过 `remote.verylook.upload` RPC 处理拖拽文件上传；
4. 本地解析 Office/PDF/PSD/ZIP 等文件；
5. 提供 `getPluginVersion` / `checkUpdate` / `uninstallPlugin` 等 RPC。

### 解析架构

- 图片：视觉模型 + 本地解析；
- 视频：抽帧 + 音频转写（yt-dlp + ffmpeg）；
- 文档：本地解析，不上传（PDF/Word/Excel/PPT/PSD/ZIP）；
- 聊天记录：跨会话引用。

## 5. Client 半部设计

客户端注册到以下 DSH slot：

- `settings.plugin.item` — 设置页插件卡片（`VerylookPluginCard`）；
- `conversation.session.header.actions` — 会话 Header 复制按钮；
- 其他 UI 组件（眼睛开关、ChatMinimap 等）。

### 版本号来源

卡片版本号从服务端 `getPluginVersion()` RPC 动态获取（读 `package.json`），不需要硬编码。

## 6. 部署

```bash
# 构建后部署到 DSH profile
cp -r lib/* /root/.dsh/profiles/web/node_modules/dsh-verylook/lib/
# 重启 DSH
```

## 7. 发布流程

1. 修改 `src/` 和/或 `package.json`；
2. 更新版本号（`package.json`，卡片自动同步）；
3. 更新 `CHANGES.md` / `CHANGELOG.md`；
4. 运行 `npm run build` 和 `npm run verify`；
5. 部署到 DSH Profile 并重启；
6. 验证各解析功能和视觉配置；
7. `git commit` 并 `git push`。

## 8. 注意事项

- `typert.host.js` 是手写清单：修改 RPC 后必须手动同步（build 不自动生成）；
- 修改客户端 DOM 时不要动 React 拥有的节点（backdrop、crumbs）；
- 所有用户输入进入 HTML 前必须经过 `escapeHtml`。
