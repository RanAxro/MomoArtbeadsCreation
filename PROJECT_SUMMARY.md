# 大喵艺点点拼绘 · 当前开发总结

英文名：**Momo Artbeads Creation**

更新日期：2026-11-25

## 1. 项目定位

本项目是面向《无限暖暖》3.0 的离线优先拼绘工具，用于创建和编辑
Pegboard（格板）图纸，并通过艺点点 Artbead 颜色完成逐格绘制。

项目当前定位为：

- 纯前端 Web 应用
- 无服务器、无用户登录、无远程数据库
- 所有图片和方案在浏览器本地处理
- 可部署至 Vercel 静态站点
- 支持 PWA，首次加载后可在离线状态下继续使用

## 2. UI 风格

整体采用黑白简约风格，主要特点是：

- 白色背景、黑色文字、少量灰色状态层
- 暗色主题为黑色背景、浅色文字
- 方角或极小圆角，避免强烈的装饰性视觉
- 使用细边框、留白和字重区分界面层级
- 导航和操作区保持紧凑，编辑区占据主要空间
- 不使用彩色渐变作为界面背景
- 艺点点颜色仅出现在颜色槽和 Canvas 图纸中
- `logo.webp` 和 `home.webp` 使用像素化渲染，关闭浏览器平滑缩放

主题模式和语言设置都会保存到 `localStorage`。

## 3. 专业术语

界面统一使用以下名称：

| 中文 | 英文 | 内部含义 |
| --- | --- | --- |
| 拼绘 | Fuse Bead | 整个作品或工具业务 |
| 艺点点 | Artbead | 单颗拼绘材料 |
| Pegboard / 格板 | Pegboard | 承载艺点点的编辑区域 |

项目名称：

- 中文：大喵艺点点拼绘
- 英文：Momo Artbeads Creation

## 4. 当前页面结构

### 顶部导航

- 左侧只显示 `logo.webp`
- 文件按钮：新建空白方案、导入图片方案、关闭当前方案
- 设置按钮：主题、语言和本地存储说明
- 右侧显示最近修改且能完整放入导航栏的方案 Tab
- “方案”标签、方案 Tab 与展开按钮整体靠右对齐
- 放不下的方案不显示在导航栏中，也不出现横向溢出
- 最右侧的展开按钮会打开全部方案列表
- 全部方案按修改时间倒序排列，最近修改的排在最上方
- 展开列表显示方案名称和最后修改时间
- 点击方案 Tab 会从 IndexedDB 恢复对应方案
- 右键方案 Tab 会显示“打开方案”、“重命名”和“删除方案”菜单
- 重命名方案会弹出名称输入对话框，名称不能为空且最多 80 个字符
- 删除方案前会弹出确认对话框，确认后才会从 IndexedDB 删除
- 切换方案前会自动保存当前方案
- 当前方案 Tab 可关闭，关闭后项目仍保留在本地方案库中

### 主工作区

- 未打开方案：
  - 不显示左侧艺点点侧栏
  - 显示 `home.webp`
  - 显示“新建空白方案”和“导入图片方案”两个普通尺寸按钮
- 已打开方案：
  - 左侧显示“艺点点”颜色栏
  - 中央显示 Pegboard
  - 顶部使用紧凑工具栏，显示方案名称、尺寸、使用数量和保存状态
  - 方案名称上方不显示“Pegboard”标签
  - 提供画笔、橡皮、填充、撤销和重做

## 5. 技术栈

| 分类 | 技术 |
| --- | --- |
| Web 框架 | SvelteKit 2 |
| UI 框架 | Svelte 5 |
| 语言 | TypeScript |
| 构建工具 | Vite |
| 静态适配器 | `@sveltejs/adapter-static` |
| 国际化 | `svelte-i18n` |
| 本地数据库 | Dexie + IndexedDB |
| 数据校验 | Zod |
| 图片处理 | Canvas 2D + OKLab 颜色距离 |
| 测试 | Vitest + `svelte-check` |
| 包管理 | npm |
| 部署 | Vercel 静态部署 |

当前主要依赖版本可查看：

```text
package.json
package-lock.json
```

## 6. 模块结构

```text
src/
├─ app.css                         全局黑白主题和基础样式
├─ app.html                        HTML 入口、主题和语言预加载
├─ lib/
│  ├─ components/
│  │  ├─ AppShell.svelte           顶部导航、方案 Tab、设置弹层
│  │  ├─ BeadCanvas.svelte         Pegboard Canvas 编辑器
│  │  └─ ProjectPreview.svelte     图片转换预览
│  ├─ config/
│  │  └─ pegboard.ts               格板尺寸与艺点点颜色配置
│  ├─ data/
│  │  └─ project-repository.ts     IndexedDB 方案仓库
│  ├─ domain/
│  │  ├─ color.ts                  十六进制、RGB、OKLab 色彩计算
│  │  ├─ palette.ts                色板与最近颜色匹配
│  │  └─ project.ts                方案模型、格子操作和填充算法
│  ├─ i18n/
│  │  ├─ index.ts                  国际化初始化与语言持久化
│  │  ├─ zh-CN.json                简体中文
│  │  └─ en-US.json                English
│  └─ modules/
│     ├─ editor/                   Canvas 编辑状态与撤销历史
│     ├─ image-import/             图片到艺点点颜色匹配
│     ├─ settings/                 明暗主题
│     └─ workspace/                方案切换、恢复与统一保存
├─ routes/
│  ├─ +page.svelte                 主工作区
│  ├─ new/                         新建空白方案
│  └─ import/                      导入图片方案
└─ static/
   ├─ logo.webp                    项目 Logo
   ├─ home.webp                    首页图片
   ├─ manifest.webmanifest         PWA 配置
   └─ sw.js                        离线缓存
```

## 7. 格板与颜色配置

统一配置文件：

```text
src/lib/config/pegboard.ts
```

当前规则：

- 默认 Pegboard：24 × 18
- 新建空白方案目前只允许 24 × 18
- 后续需要其他尺寸时，在 `PEGBOARD_PRESETS` 中增加配置
- 新建空白方案不再提供自定义宽度和高度
- 图片导入页面仍可根据图片比例生成不同格子尺寸
- 所有可用艺点点颜色均以十六进制字符串保存
- 当前配置提供 22 种颜色

每份方案保存自己的色板。修改全局颜色配置只会影响之后新建的方案，不会
改写现有方案的颜色索引。

## 8. 已实现功能

- 创建、复制、打开、关闭和恢复方案
- 导航栏仅显示可完整容纳的最近修改方案，展开按钮列出全部方案
- 右键方案 Tab 打开、重命名或删除方案
- 重命名方案并同步更新方案 Tab 与当前工作区标题
- 删除方案前显示确认对话框
- 方案 Tab 自动恢复 Canvas 内容
- 新建方案自动保存并进入主工作区
- IndexedDB 本地持久化
- 编辑后约 550 ms 防抖自动保存
- 手动保存
- 画笔、橡皮、油漆桶
- 撤销和重做
- 网格绘制与颜色块显示
- 图片缩放到 Pegboard 尺寸
- 使用 OKLab 感知色彩距离匹配艺点点颜色
- 透明图片区域转换为空格
- 简体中文与英文切换
- 亮色与暗色主题切换
- PWA 离线缓存
- Vercel 静态部署

## 9. 视觉资源

```text
static/logo.webp
static/home.webp
```

当前处理方式：

- `logo.webp` 为 16 × 16 像素图，显示为 32 × 32
- `home.webp` 为 37 × 37 像素图，桌面显示为 222 × 222
- 两张图片均使用最近邻像素渲染
- CSS 使用 `image-rendering: pixelated`
- 不使用浏览器抗锯齿缩放

## 10. 数据存储

数据库名称：

```text
momo-artbeads
```

存储位置：

```text
浏览器 IndexedDB
```

保存在本地的数据包括：

- 方案名称
- 格板宽度和高度
- 每个格子的颜色索引
- 方案色板
- 颜色编号
- 创建时间与更新时间

当前没有本地备份和导出功能。清除浏览器站点数据、换浏览器或换设备后，
已有方案不会自动迁移。

## 11. 部署方式

项目使用静态 SPA 回退输出：

```text
build/index.html
```

资源路径使用根绝对路径，确保 `/new`、`/import` 和动态编辑器链接直接
刷新时也能正确加载。

`vercel.json` 当前配置：

- Build Command：`npm run build`
- Output Directory：`build`
- 不使用 Serverless Function

## 12. 常用命令

安装依赖：

```bash
npm install
```

本地开发：

```bash
npm run dev
```

类型和 Svelte 检查：

```bash
npm run check
```

单元测试：

```bash
npm test
```

生产构建：

```bash
npm run build
```

生产预览：

```bash
npm run preview
```

## 13. 当前验证状态

- `npm run check`：0 个错误、0 个警告
- `npm test`：3 个测试文件、7 个测试全部通过
- `npm run build`：生产构建成功
- 已通过浏览器冒烟测试：
  - 新建方案成功
  - 自动进入 Pegboard
  - 方案 Tab 关闭和恢复成功
  - 暗色主题切换成功
  - 英文界面切换成功

## 14. 尚未实现或需要继续开发

- 方案压缩包备份、导入和恢复
- PNG、SVG、PDF 图纸导出
- 艺点点材料清单和库存统计
- 用户控制画布缩放和平移
- 图片裁剪、背景移除和抖动选项
- Pegboard 物理尺寸、底板分页和编号
- 镜像熨烫预览
- 方案版本快照
- 3.0 内容包、模板和主题
- 云端同步、分享链接与二维码
- 数据库结构版本演进方案（测试稳定后再设计）

按照当前产品约束，云端同步和分享功能不应直接加入现有本地数据流程，
需要单独设计隐私说明、对象存储和分享权限。
