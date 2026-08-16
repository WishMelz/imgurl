# ImgURL

基于 Vue 3、TypeScript、TSX、Pinia、Tailwind CSS 与 shadcn-vue 的 GitHub 图片托管工具。浏览器直接调用 GitHub Contents API，可完成图片批量上传、链接生成、目录浏览和删除。

## 功能

- Fine-grained GitHub Token 验证与可写仓库选择
- 选择、拖拽、粘贴及批量上传图片
- 随机或原始文件名、覆盖上传、GitHub Raw / jsDelivr 链接
- 图片库目录浏览、搜索、预览、复制和删除
- 响应式桌面侧栏与移动端导航、亮色/暗色主题

## 本地开发

```sh
pnpm install
pnpm dev
```

## 质量检查

```sh
pnpm run format
pnpm run lint
pnpm run type-check
pnpm run build
```

## GitHub Token 权限

建议创建 Fine-grained personal access token：

1. Repository access 只选择图床仓库。
2. Repository permissions / Contents 设置为 Read and write。
3. 设置合理有效期并定期轮换。

Token 默认保存在 `sessionStorage`，关闭浏览器会话后失效。只有主动开启“在此设备记住 Token”时才写入 `localStorage`。任何同源 XSS 或恶意浏览器扩展仍可能读取浏览器存储，公共设备上不要启用长期保存。

## 仓库和链接限制

- 仅支持公开仓库作为公开图床。私有仓库的下载 URL 会过期，不能作为稳定外链。
- jsDelivr 分支 URL 存在缓存，覆盖后不会立即更新；GitHub 删除源文件后，已缓存副本仍可能继续访问。因此不要上传需要撤回的敏感内容。
- GitHub Contents API 单目录最多返回 1,000 个条目，建议按年份或业务拆分目录。
- 出于活动内容安全考虑，当前不接受 SVG 上传。

## 部署

项目使用 Hash 路由，可部署到 GitHub Pages 或其他静态托管服务，无需配置 SPA history fallback。若部署到仓库子路径，请通过 Vite `base` 或部署环境设置正确资源基础路径。
