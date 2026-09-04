# VeryLook

> 当前版本 `0904-0.1.2-alpha.3`，适配 DSH `v0.1.1-rc.2`（开发者预览版）。使 DeepSeek Harness 能 Look 万物——图片、视频、音频、PSD、Office 文档、PDF、压缩包、聊天记录，通通拖进去就能看。

![DSH 插件设置页](screenshots/04-settings-zh.jpg)
![插件验证报告](screenshots/06-verification-report.jpg)

## 适配说明

DSH 目前还在开发者预览阶段，版本更新较频繁，每次大版本更新后插件需要重新适配。

当前版本对应 DSH `v0.1.1-rc.2`，后续会持续跟进。

## 部署方式

从 GitHub 克隆仓库后本地构建：

```bash
git clone https://github.com/ideasir/dsh-verylook.git
cd dsh-verylook
npm install
npm run build
```

构建产物在 `lib/` 目录。把产物复制到 DSH profile 的 `node_modules` 目录：

```bash
mkdir -p ~/.dsh/profiles/web/node_modules/dsh-verylook
cp -r lib/* ~/.dsh/profiles/web/node_modules/dsh-verylook/lib/
```

重启 DSH 即可。在设置页 Plugins → VeryLook 中配置模型。

> 插件尚未发布到 npm，需要从仓库克隆构建。

## 功能介绍

### 📁 Look 文件

把文件拖进聊天框或直接粘贴，AI 就能理解和分析：

| 文件类型 | 说明 |
|---------|------|
| 📷 **图片** | PNG / JPG / GIF / WebP / BMP / SVG / TIFF / HEIC / RAW 等，走视觉模型识别 |
| 🎬 **视频** | 画面识别、场景分析、字幕提取、音频转写，ffmpeg 抽帧 + 视觉模型 |
| 🎵 **音频** | 语音转录、录音内容理解，ffmpeg 采样 + 音频模型 |
| 📄 **PDF** | 纯文本提取与分页解析，全部本地处理不上传 |
| 📑 **Office** | Word / Excel / PPT 本地解析，零外部网络请求 |
| 🎨 **PSD** | Photoshop 设计稿自动提取合成图预览、图层树分析 |
| 📦 **ZIP** | 压缩包内部文件一览理解，支持查看目录结构和文件内容 |
| 🔗 **视频链接** | 抖音 / B 站 / YouTube 等平台链接自动解析 |

### 💬 Look 聊天记录

- **新对话 Look 旧对话** — 粘贴 `dsh-session://` 引用，AI 能看懂之前的对话上下文
- **会话 ID 一键复制** — 方便跨会话传递上下文

### 🖼️ 渲染增强

- 出图/出视频结果自动渲染为**缩略图卡片**，带视频播放按钮和 lightbox 弹窗
- 引用系统：缩略图引用按钮 → 输入框上方引用栏 → 发送后渲染为引用卡片

### 📤 文件上传通道

- 非图片/视频文件（PDF、Office、ZIP、PSD 等）走独立上传通道，不受原生限制
- 拖拽悬停时显示 DropOverlay 上传标识
- 文件类型图标对齐原生 64px tile 规范

### 🧩 其他能力

- **小眼睛开关** — 打开时走模型视觉能力，关闭时走文件上传通道，按会话独立切换
- **功能检测** — 一键检测全部 11 项能力是否可用（图像/视频/声音/PSD/Office/PDF/ZIP/视频平台/会话引用/渲染增强/上传通道）
- **环境检测** — 一键检查本地依赖（ffmpeg / yt-dlp / Python 等）是否完整
- **设置面板** — 配置视觉模型、音频模型

## 依赖

- `pdfjs-dist` — PDF 解析
- `psd.js` — PSD 文件解析
- `adm-zip` / `fflate` — ZIP 解压
- `fast-xml-parser` — Office XML 解析
- `pngjs` — PNG 图片处理
- 其他靠 DSH 自身的 Files API，零外部网络请求

## 变更记录

参见 [CHANGELOG.md](CHANGELOG.md)。