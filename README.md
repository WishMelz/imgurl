# imgurl - 基于 GitHub 的图片管理系统

[![License](https://img.shields.io/github/license/WishMelz/imgurl)](https://github.com/WishMelz/imgurl/blob/main/LICENSE)
[![Stars](https://img.shields.io/github/stars/WishMelz/imgurl)](https://github.com/WishMelz/imgurl/stargazers)
[![Forks](https://img.shields.io/github/forks/WishMelz/imgurl)](https://github.com/WishMelz/imgurl/network/members)

> 🚀 一个免费、简单、高效的图片管理系统，基于 GitHub API 实现图片上传和管理，通过 jsDelivr CDN 加速图片访问。

## ✨ 特性

- 🆓 **完全免费** - 基于 GitHub 仓库，无需额外费用
- 🚀 **CDN 加速** - 使用 jsDelivr 提供全球 CDN 加速
- 🔒 **安全可靠** - 使用 GitHub Personal Access Token 认证
- 📱 **响应式设计** - 支持桌面端和移动端访问
- 🎨 **简洁易用** - 拖拽上传，一键复制链接
- 📊 **图片管理** - 支持图片列表查看和管理

## 🌐 在线体验

- 主站：https://wishmelz.github.io/imgurl

## 📦 快速开始

### 环境要求

- Node.js 14.0+
- npm 或 yarn

### 安装依赖

```bash
# 使用 npm
npm install

# 或使用 yarn
yarn install
```

### 本地开发

```bash
# 启动开发服务器
npm run dev

# 或使用 yarn
yarn dev
```

### 构建部署

```bash
# 构建生产版本
npm run build

# 或使用 yarn
yarn build
```

## 🔧 配置指南

### 步骤 1：获取 GitHub Token

1. 访问 [GitHub Personal Access Tokens](https://github.com/settings/tokens)
2. 点击 **Generate new token** 按钮
3. 在 **New personal access token** 页面中：
   - 设置 Token 名称（如：`imgurl-token`）
   - 选择过期时间
   - 勾选以下权限：
     - ✅ `repo` - 访问仓库权限
     - ✅ `user` - 访问用户信息权限

![获取 Token](https://cdn.jsdelivr.net/gh/WishMelz/file/image/getToken.png)

4. 点击 **Generate token** 按钮生成 Token

![Token 生成](https://cdn.jsdelivr.net/gh/WishMelz/file/image/token.png)

> ⚠️ **重要提醒**：生成的 Token 只会显示一次，请务必保存！

### 步骤 2：创建图片存储仓库

1. 在 GitHub 上创建一个新的仓库（可以是私有或公开）
2. 进入仓库页面，创建一个 Release：
   - 点击 **Releases** 标签页
   - 点击 **Create a new release**
   - 输入版本号（如：`v1.0.0`）
   - 点击 **Publish release**

<img src="https://cdn.jsdelivr.net/gh/WishMelz/file/image/repo1.png" alt="创建 Release 步骤1" width="600" />

<img src="https://cdn.jsdelivr.net/gh/WishMelz/file/image/repo2.png" alt="创建 Release 步骤2" width="600" />

### 步骤 3：配置应用

1. 打开 ImgURL 应用
2. 点击设置按钮，填入以下信息：
   - **GitHub Token**：在步骤 1 中获取的 Token
   - **仓库路径**：格式为 `用户名/仓库名`，如：`WishMelz/my-images`

<img src="https://cdn.jsdelivr.net/gh/WishMelz/file/image/set.png" alt="应用配置" width="600" />

## 🎯 使用方法

### 上传图片

- 拖拽图片到上传区域
- 或点击上传按钮选择图片
- 支持批量上传
- 自动生成可访问的 CDN 链接

<img src="https://cdn.jsdelivr.net/gh/WishMelz/file/image/8e1363f2deee8dbedd9b1651974a1498.png" alt="上传图片" width="600" />

### 管理图片

- 查看已上传的图片列表
- 一键复制图片链接
- 支持不同格式的链接（Markdown、HTML、直链）

<img src="https://cdn.jsdelivr.net/gh/WishMelz/file/image/4af4a12a816480b138bbd2ea27871438.png" alt="图片列表" width="600" />

## 🤝 贡献

我们欢迎所有形式的贡献！

1. Fork 本项目
2. 创建您的功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## 📝 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📈 项目统计

[![Star History Chart](https://api.star-history.com/svg?repos=WishMelz/imgurl&type=Date)](https://star-history.com/#WishMelz/imgurl&Date)

## 🐛 问题反馈

如果您遇到任何问题或有改进建议，请提交 [Issues](https://github.com/WishMelz/imgurl/issues)。

## 📞 联系我们

- 项目地址：https://github.com/WishMelz/imgurl
- 问题反馈：https://github.com/WishMelz/imgurl/issues

---

⭐ 如果这个项目对您有帮助，请给我们一个 Star！
