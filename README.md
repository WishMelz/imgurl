# ImgURL · 基于 GitHub Contents API 的轻量图片托管工具

[![License](https://img.shields.io/github/license/WishMelz/imgurl)](https://github.com/WishMelz/imgurl/blob/main/LICENSE)
[![Stars](https://img.shields.io/github/stars/WishMelz/imgurl)](https://github.com/WishMelz/imgurl/stargazers)
[![Forks](https://img.shields.io/github/forks/WishMelz/imgurl)](https://github.com/WishMelz/imgurl/network/members)

> 一个完全运行在浏览器中的轻量 GitHub 图床与图片管理工具。直接调用 GitHub Contents API 完成图片上传、目录浏览、外链生成与删除，无需独立后端服务器，无需创建 Release。

## 特性

- **纯前端零后端**：Token 仅保存在浏览器（默认仅当前会话 `sessionStorage`，可选长期记住），直接与 `api.github.com` 通信。
- **高效上传体验**：支持点击选择、拖拽、剪贴板 `Ctrl + V` 粘贴截图、单次批量上传、真实上传进度、失败项一键重试与可选本地压缩 / 转 WebP。
- **多源外链支持**：支持 jsDelivr CDN、GitHub Raw 及自定义 CDN 链接模板（支持 `{owner}`、`{repo}`、`{branch}`、`{path}` 占位符），一键复制 URL / Markdown / BBCode / HTML。
- **完整图库管理**：目录面包屑导航（同步 URL 参数支持浏览器前进后退）、搜索与排序、多选批量复制/删除、灯箱键盘切换、图片加载失败自动回退 GitHub Raw、jsDelivr 缓存刷新。
- **现代响应式界面**：基于 Vue 3 + TypeScript + Tailwind CSS v4 + Reka UI，支持浅色 / 深色 / 跟随系统三态主题与移动端自适应抽屉导航。

## 在线体验

- 主站：https://wishmelz.github.io/imgurl

## 快速开始

### 环境要求

- Node.js `^22.18.0` 或 `>= 24.0.0`
- pnpm `10.x`

### 本地开发

```bash
# 安装依赖
pnpm install

# 启动本地开发服务
pnpm dev
```

### 质量检查与构建

```bash
# 类型检查
pnpm type-check

# 代码规范检查（Oxlint + ESLint）
pnpm lint

# 运行单元测试
pnpm test

# 生产构建
pnpm build
```

## 配置指南

### 1. 准备公开图片仓库

在 GitHub 上创建一个**公开仓库**（如 `my-images`），并确保仓库已初始化默认分支（例如包含一个 `README.md`）。

> 私有仓库的原始文件链接需要鉴权且 jsDelivr 无法访问，因此不建议用于公开图床。

### 2. 创建 Fine-grained Personal Access Token

1. 访问 [GitHub Fine-grained Personal Access Tokens](https://github.com/settings/personal-access-tokens/new)。
2. 填写令牌名称并设置合理的有效期。
3. **Repository access** 选择 `Only select repositories`，仅勾选目标图床仓库。
4. 在 **Repository permissions** 中将 **Contents** 设为 `Read and write`。
5. 点击 **Generate token** 并复制生成的 Token。

### 3. 在 ImgURL 中绑定仓库

1. 打开应用的 **仓库配置** 页面，粘贴 Token 并点击 **验证连接**。
2. 在 **目标仓库** 下拉列表中选择刚才创建的公开仓库并点击 **绑定仓库**。
3. 前往 **上传图片** 页面设置上传目录（留空则上传至仓库根目录）即可开始使用。

## 安全说明

- Token 遵循最小权限原则，仅授予单个图床仓库的 `Contents: Read and write` 权限即可。
- 默认关闭“在此设备记住 Token”，关闭浏览器标签页后自动清除；公共设备请勿开启持久化。
- 生产构建会自动注入 `Content-Security-Policy` 元标签，限制脚本来源与外连域。

## 许可证

本项目基于 [MIT License](LICENSE) 开源。
