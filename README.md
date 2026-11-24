# 大喵艺点点拼绘

**Momo Artbeads Creation**

![Momo Artbeads Creation logo](static/logo.webp)

面向《无限暖暖》3.0 的离线优先拼绘工作区。应用使用 SvelteKit 2、Svelte 5
和 TypeScript，不需要服务器、用户登录或远程数据库。

## 当前界面

- 顶部导航：文件、设置与方案 Tab
- 左侧艺点点栏：切换当前 Artbead 颜色
- 中央 Pegboard：24 × 18 默认尺寸及 Canvas 编辑器
- 无打开方案时：显示新建空白方案与导入图片方案入口
- 亮色、暗色主题
- 简体中文、English 界面
- 所有方案自动保存至浏览器 IndexedDB

## 配置

可用颜色、默认 Pegboard 和尺寸预设统一位于：

```text
src/lib/config/pegboard.ts
```

颜色使用十六进制字符串保存。修改 `ARTBEAD_COLORS` 后，新建方案会使用新的
艺点点配色。已有方案保留创建时的色板，以避免作品颜色被配置更新破坏。

## 本地运行

```bash
npm install
npm run dev
```

检查与构建：

```bash
npm run check
npm test
npm run build
```

## 模块结构

```text
src/lib/config/                  Pegboard、尺寸与艺点点颜色配置
src/lib/domain/                  方案、色板、颜色计算等领域模型
src/lib/data/                    IndexedDB 仓库
src/lib/modules/workspace/       方案切换、恢复和统一保存
src/lib/modules/editor/          Canvas 编辑状态与历史记录
src/lib/modules/image-import/    图片到 Pegboard 的颜色匹配
src/lib/modules/settings/        明暗主题
src/lib/i18n/                    中英文翻译
src/lib/components/              导航、Pegboard 与预览组件
src/routes/                      SvelteKit 页面
```

## Vercel

应用通过 `@sveltejs/adapter-static` 输出到 `build/`，`vercel.json`
提供 SPA 回退，不需要任何 Serverless Function。

- Build Command：`npm run build`
- Output Directory：`build`

## 数据说明

方案数据保存在当前浏览器的 IndexedDB 中。清除站点数据、更换浏览器或设备
不会自动迁移方案，因此在加入导出与备份功能前应避免随意清理站点数据。
