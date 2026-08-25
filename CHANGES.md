# CHANGE LOG

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