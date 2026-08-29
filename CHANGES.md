# CHANGE LOG

## 2026-08-29 v0829-0.1.2 渠道编辑改为弹窗（与其他插件统一交互）

### 为什么
Look 插件渠道编辑原本是"当前页面内嵌展开"（点渠道卡片在卡片下方展开表单），
与其他 ideasir 插件（makemake/passpass/veryIM）的弹窗形式不统一，主任要求改成弹窗。

### 改了哪些（客户端）
#### ProviderListEditor.tsx
- 渠道卡片行不再内嵌 renderEditor（点卡片只打开弹窗）
- 新增弹窗：fixed 遮罩 + 居中面板（maxWidth 560，80vh 内滚动）
  - 右上角 X 关闭按钮（IconCloseOutline16），点遮罩也可关闭
  - 编辑/添加共用 renderEditor 表单
  - 底部：保存 → 取消 → 删除（靠右红色，仅编辑模式，confirm 后删除并关闭）
- 添加渠道按钮保持底部独立

#### locales.ts
- 中英文新增 settings.provider.edit key（编辑提供商 / Edit provider）

### 验证
- tsdown 构建通过（lib/client.js 182KB）
- 部署产物确认含弹窗代码（position:fixed）、关闭图标、删除确认


## 2026-08-25 v0825-0.1.1-rc.2 会话Header复制按钮 + typert.host.js补全

### 为什么
两个问题同时修：①点击「全部检测」报 Failed to fetch（typert.host.js 漏登）；②复制会话ID按钮放在标题右边，对话出错时消息栏消失导致复制功能不可用。

### 改了哪些

#### typert.host.js 补全
- 新增 4 个 RPC 方法的 members 描述：capabilityCheck、getPluginVersion、checkUpdate、uninstallPlugin
- 新增对应的 invocations 路由条目（`dsh-looklook#looklook/capabilityCheck` 等）
- 同步部署到源码库 `/vol1/1000/DeepSeek/dsh-looklook/lib/typert.host.js` 和 profile `/root/.dsh/profiles/web/node_modules/dsh-looklook/lib/typert.host.js`

#### 会话 Header 复制按钮
- 新建 `src/client/SessionHeaderCopyButton.tsx`
- 在 `conversation.session.header.actions` 注册（order=-100）
- useEffect 中将按钮 DOM 节点从 headerActions 移动到 titleCluster（面包屑之前）
- 视觉上显示在会话标题左边，始终可见（不依赖消息渲染状态）
- 复用现有复制逻辑：`dsh-session://<id>\n标题: <title>`
- `CopySessionIdButton`（消息栏按钮）保留不动，两条路并存

#### 版本号统一
- package.json version: `0.1.1-rc.2` → `0825`
- getPluginVersion fallback 全部改为 `'0825'`

### 踩过的坑
- **typert.host.js 是手写清单**：build 不生成，改 remote.ts 后必须手动同步。对比命令见上方。
- **DOM 移动 vs CSS order**：按钮原本在 headerActions（flex 容器B），标题在 titleCluster（flex 容器A）。两者是平级 flex 子项，不能单纯用 order 调整。正确方案是用 insertBefore 把按钮 DOM 节点物理移到 titleCluster 内部。
- **React 虚拟 DOM 安全**：按钮是由 DSH slot 系统创建的，移走这个节点不会冲突；但不能修改任何 React 拥有的 DOM 节点（如 backdrop、crumbs）。

### 踩坑记录（typert.host.js）
同上。

### 部署
```bash
# 重新构建
cd /vol1/1000/DeepSeek/dsh-looklook && npm run build

# 部署客户端 bundle
cp lib/client.js /root/.dsh/profiles/web/node_modules/dsh-looklook/lib/client.js
cp lib/client.js.map /root/.dsh/profiles/web/node_modules/dsh-looklook/lib/client.js.map

# 重启 DSH
kill $(ss -tlnp | grep 3080 | grep -oP 'pid=\K[0-9]+')
dsh web --no-open
```

## 2026-08-22 适配 DSH 0.1.1-rc.2

### 为什么
DSH 从 0.1.0-rc.8 升级到 0.1.1-rc.2，需要重新构建适配。

### 改了什么
- package.json 版本号改为 `0.1.1-rc.2`（跟随 DSH 适配版本）
- 所有 `@deepseek-ai/*` 依赖从 `0.1.0-rc.8` 升到 `0.1.1-rc.2`
- 客户端 `getPluginVersion()` 加了硬编码 fallback `0.1.1-rc.2`，remote RPC 不通时显示版本号

### 踩过的坑
- npm 版本号不能用 `0821-rc.8`（非合法 semver），必须 `0.1.1-rc.2`
- `npm install` 会把 profile 里以 symlink 安装的插件删掉，必须重新复制完整目录（含 node_modules）
- node 从插件源码路径解析 `@deepseek-ai/*`，symlink 到 profile 的 node_modules 时 Node 解析不到，必须把插件整个目录复制过去

### 部署
```bash
# 构建
cd /vol1/1000/DeepSeek/dsh-looklook && npm run build
cd /vol1/1000/DeepSeek/dsh-makemake && npm run build

# 部署（完整复制含 node_modules）
cd /vol1/1000/DeepSeek/dsh-looklook && npm install --legacy-peer-deps
cd /vol1/1000/DeepSeek/dsh-makemake && npm install --legacy-peer-deps
rm -rf /root/.dsh/profiles/web/node_modules/dsh-looklook /root/.dsh/profiles/web/node_modules/dsh-makemake
cp -r /vol1/1000/DeepSeek/dsh-looklook /root/.dsh/profiles/web/node_modules/dsh-looklook
cp -r /vol1/1000/DeepSeek/dsh-makemake /root/.dsh/profiles/web/node_modules/dsh-makemake

# 重启
kill $(ss -tlnp | grep 3080 | grep -oP 'pid=\K[0-9]+')
cd /root/.dsh/profiles/web && npx dsh --profile web --port 3080 --no-open
```
## 2026-08-29 — 渠道编辑改为弹窗（与其他插件统一）

### 问题
Look 插件渠道编辑是"当前页面内嵌展开"（点渠道卡片在卡片下方展开表单），
其他插件（makemake/passpass/veryIM）是弹窗形式，交互不统一。

### 修改（客户端）
- ProviderListEditor.tsx：渠道卡片行不再内嵌 renderEditor
- 点卡片/编辑按钮 → setEditingId → 弹出 fixed 遮罩弹窗（居中面板，含表单+保存/取消）
- 点添加 → setAddDraft → 同样弹窗
- 弹窗点击遮罩关闭、面板内 stopPropagation
- locales.ts：中英文加 settings.provider.edit key

### 验证
- tsdown 构建通过，弹窗代码已部署

### 补充（弹窗细节，2026-08-29）
- 弹窗右上角关闭按钮：从 IconTrashOutline16 改为 IconCloseOutline16（X 图标）
- 删除按钮移到保存/取消后面（marginLeft auto 靠右），仅编辑模式显示，confirm 后删除并关闭弹窗
