# Zhao's 3D Game Art Portfolio

这是一个专为您量身定制的静态作品集网站，采用纯 HTML、CSS 和 JavaScript 编写，具有以下特点：
- **深色极简风格**：专业、安静、克制，突出大图展示，非常适合游戏美术与 3D 资产展示。
- **全响应式设计**：在桌面端和移动端均能完美适配。
- **易于维护**：无需任何后台或构建工具，直接修改 HTML 代码和替换图片即可。

## 文件结构

- `index.html`: 首页（包含全屏大图和精选作品）
- `works.html`: 作品集列表页（支持简单的标签分类过滤）
- `project.html`: 项目详情模板页（支持多图轮播和长图流展示）
- `about.html`: 关于我页面
- `contact.html`: 联系方式与简历下载页
- `assets/`
  - `css/styles.css`: 全站样式文件（颜色、排版、布局）
  - `js/main.js`: 核心交互逻辑（移动端菜单、分类过滤、详情页数据渲染）
  - `images/`: 存放所有作品图片和个人头像

## 如何替换作品和图片

### 1. 准备图片
将您的 3D 作品渲染图、展示图保存到 `assets/images/` 目录下。建议：
- 首页首屏大图：准备一张横向大图（如 `hero-desktop.jpg`，推荐 1920x1080）和一张竖向图（如 `hero-mobile.jpg`，推荐 800x1200）。
- 缩略图：建议裁切为 4:3 比例，以保证作品列表页的对齐美观。
- 头像：准备一张正方形或圆形的个人头像（如 `avatar.jpg`）。

### 2. 修改首页 (index.html)
- 找到 `<section class="hero">` 中的 `<img>` 标签，修改 `src` 属性为您的首屏图路径。
- 在 `<div class="featured-grid">` 中，替换 `href` 链接中的 `id`（例如 `project.html?id=dragon-sculpt`）以及 `<img>` 的路径和文字。

### 3. 修改作品列表页 (works.html)
- 在 `<section class="cards-grid">` 中，每一个 `<a class="card">` 就是一个作品卡片。
- 修改卡片的 `data-cat` 属性来设置分类（支持多分类，空格隔开，如 `weapon sculpt`）。
- 替换图片路径、标题和描述。

### 4. 修改项目详情页数据 (assets/js/main.js)
详情页通过读取 URL 中的 `?id=xxx` 来动态渲染内容，以避免您创建大量重复的 HTML 文件。
- 打开 `assets/js/main.js`，找到 `const projectsData = { ... }` 对象。
- 在这个对象中，按照现有的格式（如 `'dragon-sculpt'`）添加或修改您的项目数据。
- 您可以配置：标题、分类、年份、简介、职责、工具、轮播图数组 (`images`) 以及底部长图数组 (`gallery`)。

### 5. 修改简历
将您的 PDF 简历重命名为 `Resume.pdf` 并放入 `assets/` 文件夹中，即可在“关于我”和“联系”页面直接点击下载。

## 如何预览

您可以直接在浏览器中双击打开 `index.html` 文件进行本地预览。如果需要部署，直接将整个文件夹上传至 GitHub Pages、Vercel 或任何静态网页托管服务即可。