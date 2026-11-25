# 知识题库

面向自己和少数人的复习工具,以简答题为主。桌面应用,支持 macOS 和 Windows,离线使用,不依赖服务器。

- **看题模式**:按顺序展示所选题库的全部题目和答案,支持目录和搜索
- **背题模式**:所选题库随机洗牌,每次一题,答案默认隐藏
- **考试模式**:暂未开放
- **题库管理**:Markdown 编辑与预览,支持 Markdown(zip)和 Excel 导入导出

技术栈:Electron · TypeScript · React · Vite(electron-vite)· SQLite(sql.js,WebAssembly 版,无需本机编译)

## 开发环境

需要安装:

- [Node.js](https://nodejs.org/) 22.12 或更高版本
- [Git](https://git-scm.com/)

```bash
npm install     # 安装依赖
npm run dev     # 启动开发模式(改代码后界面自动刷新)
```

其他命令:

| 命令 | 作用 |
|---|---|
| `npm test` | 运行单元测试 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run build` | 编译到 `out/` |
| `npm run dist:win` | 打包 Windows 安装包到 `dist/` |
| `npm run dist:mac` | 打包 macOS 安装包到 `dist/`(需要在 Mac 上执行) |

Windows 上如果 PowerShell 提示"禁止运行脚本",先运行一次:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## 题库文件格式

导入支持三种文件,可以一次选择多个:

- **Markdown 压缩包(.zip,推荐)**:`<题库名>/questions.md` 加同级的 `images/` 图片文件夹。一个压缩包里可以有多个题库。
- **单个 Markdown 文件(.md)**:不带图片。
- **Excel(.xlsx)**:第一个工作表,第一行表头需要"题干""答案"两列。

`questions.md` 的写法:

````markdown
# 题库名

## 第一道题的题干

---answer---

答案,支持 **Markdown**、代码块、表格、公式 $O(n)$ 和图片 ![](images/a.png)

## 第二道题的题干

---answer---

……
````

导出的题库使用同样的格式。设置页可以下载 Markdown 和 Excel 模板。

## 目录结构

```
src/
├─ shared/      主进程与界面共用的类型和 IPC 接口定义
├─ main/        主进程:窗口、数据库、文件读写
│   ├─ db/      连接、迁移、各表的读写
│   └─ ipc/     界面可调用的接口
├─ preload/     把白名单接口暴露为 window.api
└─ renderer/    React 界面
    └─ src/
        ├─ components/  侧边栏、提示等通用组件
        ├─ pages/       首页、看题、背题、题库管理、设置
        ├─ stores/      Zustand 状态
        ├─ i18n/        中文和英文文案
        └─ styles/      设计 token(浅色/深色)和全局样式
```

用户数据保存在系统的应用数据目录(`app.db` 是数据库,`assets/<题库 id>/images/` 是题目中的图片):

- Windows:`%APPDATA%\知识题库\`
- macOS:`~/Library/Application Support/知识题库/`

## 开发进度

| 阶段 | 内容 | 状态 |
|---|---|---|
| M1 骨架 | 窗口、侧边栏与路由、数据库与迁移、IPC、主题/字号/语言设置 | ✅ |
| M2 题库管理 | 题库和题目的增删改、Markdown 编辑器与预览、图片粘贴 | ✅ |
| M3 看题模式 | 首页题库勾选、全量列表、目录、搜索高亮、阅读位置 | ✅ |
| M4 背题模式 | 洗牌会话、显示/隐藏答案、快捷键、进度 | ✅ |
| M5 导入导出 | Markdown zip、Excel、同名冲突、导出、模板、备份恢复 | ✅ |
| M6 设置 | 完善设置页、全部文案中英文 | |
| M7 发布 | GitHub Actions 双平台构建、Releases、自动更新 | |
