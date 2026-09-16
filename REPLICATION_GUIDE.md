# 终端风格个人主页复刻指南

## Apple Macintosh 风格 · Think Different

---

## 目录

1. [原始网站分析](#1-原始网站分析)
2. [技术架构](#2-技术架构)
3. [麦金塔风格改造方案](#3-麦金塔风格改造方案)
4. [项目结构](#4-项目结构)
5. [实现步骤](#5-实现步骤)
6. [核心代码实现](#6-核心代码实现)
7. [部署说明](#7-部署说明)

---

## 1. 原始网站分析

### 1.1 网站概览

**目标网站**: https://jiangyy.github.io/  
**作者**: 蒋炎岩 (南京大学计算机科学与技术学院副教授)  
**核心理念**: 将个人主页打造成一个完整的终端模拟器，用户可以通过输入命令来浏览信息

### 1.2 核心特性

| 特性 | 描述 |
|------|------|
| 终端模拟器 | 使用 xterm.js 实现完整的终端交互体验 |
| 虚拟文件系统 | 模拟 Unix 目录结构，支持 cd/ls/tree/find 等命令 |
| 文档即命令 | 每个 Markdown 文档既是内容又是可执行命令 |
| 管道支持 | 支持 `|` 管道操作符，命令输出可作为下一个命令的输入 |
| 分页器 | 内置 more/less 分页器，支持全屏 TUI 交互 |
| 自动补全 | Tab 键智能补全命令和文件名 |
| 历史记录 | 上下箭头浏览命令历史 |
| CRT 视觉效果 | 扫描线、暗角、像素位移等复古显示效果 |

### 1.3 技术栈

```
前端框架: 纯 vanilla JavaScript (无框架)
终端引擎: xterm.js v5.x
构建工具: Vite
样式: 纯 CSS
字体: Maple Mono (等宽编程字体)
Markdown: marked.js (内嵌)
```

---

## 2. 技术架构

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser                                │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    HTML Layer                       │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │              #term-host                     │   │   │
│  │  │  ┌─────────────────────────────────────┐   │   │   │
│  │  │  │           #term-screen              │   │   │   │
│  │  │  │  ┌─────────────────────────────┐   │   │   │   │
│  │  │  │  │         xterm.js            │   │   │   │   │
│  │  │  │  │  ┌─────────────────────┐   │   │   │   │   │
│  │  │  │  │  │   Terminal Core     │   │   │   │   │   │
│  │  │  │  │  │   - Buffer          │   │   │   │   │   │
│  │  │  │  │  │   - Renderer        │   │   │   │   │   │
│  │  │  │  │  │   - Input Handler   │   │   │   │   │   │
│  │  │  │  │  └─────────────────────┘   │   │   │   │   │
│  │  │  │  └─────────────────────────────┘   │   │   │   │
│  │  │  └─────────────────────────────────────┘   │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 Application Layer                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │   │
│  │  │   Shell     │  │  Commands   │  │   Files    │  │   │
│  │  │  - prompt   │  │  - registry │  │  - virtual │  │   │
│  │  │  - readline │  │  - executor │  │  - markdown│  │   │
│  │  │  - history  │  │  - parser   │  │  - tree    │  │   │
│  │  └─────────────┘  └─────────────┘  └────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Visual Layer                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │   │
│  │  │  CRT Filter │  │  Scanlines  │  │  Vignette  │  │   │
│  │  │  (SVG)      │  │  (CSS)      │  │  (CSS)     │  │   │
│  │  └─────────────┘  └─────────────┘  └────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 核心模块

#### Shell 模块
```javascript
class Shell {
  constructor(terminal, fileSystem, commandRegistry) {
    this.term = terminal;
    this.fs = fileSystem;
    this.commands = commandRegistry;
    this.buffer = '';
    this.cursor = 0;
    this.history = [];
    this.historyIndex = -1;
    this.mode = 'shell'; // 'shell' | 'tui'
  }

  async start() {
    for (;;) {
      this.buffer = '';
      this.cursor = 0;
      this.showPrompt();
      const line = await this.readLine();
      await this.execute(line);
    }
  }

  showPrompt() {
    const prompt = `\x1b[32m${this.username}\x1b[0m:\x1b[34m${this.cwd}\x1b[0m$ `;
    this.term.write(prompt);
  }
}
```

#### 虚拟文件系统
```javascript
class VirtualFileSystem {
  constructor() {
    this.root = {
      type: 'dir',
      children: {
        'bin': { type: 'dir', children: {} },
        'help': { type: 'file', content: '...' },
        'bio': { type: 'file', content: '...' },
        'papers': { type: 'file', content: '...' },
        'team': { type: 'file', content: '...' }
      }
    };
    this.cwd = '/';
  }

  resolve(path) {
    // 解析路径，支持相对路径和绝对路径
  }

  ls(path) { /* ... */ }
  cat(path) { /* ... */ }
  tree(path) { /* ... */ }
}
```

#### 命令注册表
```javascript
const commands = new Map();

commands.set('ls', {
  description: 'List directory contents',
  usage: 'ls [path]',
  execute: (args, fs, stdout) => {
    const path = args[0] || fs.cwd;
    const items = fs.ls(path);
    stdout.write(items.join('\n'));
  }
});

commands.set('cat', {
  description: 'Print file contents',
  usage: 'cat <path>',
  execute: (args, fs, stdout) => {
    const content = fs.cat(args[0]);
    stdout.write(content);
  }
});
```

---

## 3. 麦金塔风格改造方案

### 3.1 设计理念

**Think Different** - 向 1984 年原版 Macintosh 致敬

原版 Macintosh (1984) 的视觉特征：
- 单色黑白显示 (512×342 像素)
- Chicago 字体 (像素风格无衬线字体)
- 经典的菜单栏
- 窗口带有标题栏和关闭按钮
- 鼠标光标为箭头形状
- 简洁的图标设计

### 3.2 视觉改造方案

#### 3.2.1 配色方案

```css
:root {
  /* Macintosh 经典黑白配色 */
  --mac-bg: #ffffff;
  --mac-fg: #000000;
  --mac-gray: #888888;
  --mac-light-gray: #cccccc;
  --mac-dark-gray: #444444;
  
  /* 窗口元素 */
  --mac-titlebar-bg: #dddddddd;
  --mac-titlebar-active: #000000;
  --mac-titlebar-inactive: #888888;
  
  /* 强调色 (可选，致敬 System 7 彩色时代) */
  --mac-accent: #0000ff;
  --mac-selection: #000000;
  --mac-selection-fg: #ffffff;
}
```

#### 3.2.2 字体选择

```css
/* 方案 A: 使用 Chicago 字体 (最正宗) */
@font-face {
  font-family: 'Chicago';
  src: url('/fonts/Chicago.woff2') format('woff2');
}

/* 方案 B: 使用现代像素字体 (推荐) */
@font-face {
  font-family: 'MacClassic';
  src: url('/fonts/MacClassic.woff2') format('woff2');
}

/* 方案 C: 使用系统字体回退 */
font-family: 'Chicago', 'Geneva', 'Monaco', 'Courier New', monospace;
```

**推荐字体资源**:
- [ChicagoFLF](https://fonts.google.com/specimen/ChicagoFLF) - Google Fonts
- [MacClassic](https://int10h.org/oldschool-pc-fonts/) - Oldschool PC Fonts
- [Print Char 21](https://int10h.org/oldschool-pc-fonts/) - 复古 Mac 风格

#### 3.2.3 窗口装饰

```
┌──────────────────────────────────────────────────────┐
│ ■ ■ ■                                    My Mac Home │
├──────────────────────────────────────────────────────┤
│                                                      │
│  jyy:~$ bio                                          │
│  ─────────────────────────────────────────────────── │
│                                                      │
│  # 蒋炎岩                                            │
│                                                      │
│  Associate Professor                                 │
│  School of Computer Science                          │
│  Nanjing University                                  │
│                                                      │
│  jyy:~$ _                                            │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### 3.2.4 光标样式

```css
/* 块状光标 (经典 Mac 风格) */
.xterm .xterm-cursor-layer {
  background-color: var(--mac-fg);
}

/* 或者使用下划线光标 */
.xterm .xterm-cursor-layer {
  border-bottom: 2px solid var(--mac-fg);
}
```

### 3.3 交互改造

#### 3.3.1 命令提示符

```javascript
// 原版 (Unix 风格)
const prompt = `\x1b[32m${user}\x1b[0m:\x1b[34m${cwd}\x1b[0m$ `;

// Macintosh 风格
const prompt = `${user}@mac:${cwd}> `;
// 或者更简洁
const prompt = `Macintosh:${cwd} $ `;
```

#### 3.3.2 帮助信息

```javascript
const helpText = `
Macintosh Terminal v1.0
======================

Available commands:
  help      Show this help message
  ls        List files
  cat       Show file contents
  cd        Change directory
  pwd       Print working directory
  clear     Clear screen
  about     About this Mac
  history   Command history

Type a command and press Return.
`;
```

#### 3.3.3 启动动画

```javascript
async function bootAnimation(term) {
  const logo = `
    __  ________  _____ 
   / / / /_  __/ / /   |
  / /_/ / / / / / / /| |
 / __  / / / / / /___/ 
/_/ /_/ /_/ /_/_____/  
                       
  Think Different.
  `;
  
  term.write(logo);
  await delay(1500);
  term.clear();
}
```

### 3.4 视觉效果对比

| 效果 | 原版 (CRT 风格) | Macintosh 风格 |
|------|----------------|----------------|
| 背景 | 浅灰 #fafafa | 纯白 #ffffff |
| 文字 | 深灰 #2e3338 | 纯黑 #000000 |
| 字体 | Maple Mono | Chicago / MacClassic |
| 扫描线 | 有 (repeating-linear-gradient) | 无 |
| 暗角 | 有 (radial-gradient) | 无 |
| 像素位移 | 有 (SVG feTurbulence) | 无 |
| 窗口边框 | 圆角 8px | 直角 + 标题栏 |
| 光标 | 闪烁竖线 | 块状闪烁 |

---

## 4. 项目结构

```
githubPage/
├── index.html              # 主入口文件
├── style.css               # 主样式文件
├── macintosh.css           # Macintosh 风格样式
├── favicon.svg             # 网站图标
├── fonts/                  # 字体文件
│   ├── Chicago.woff2
│   └── MacClassic.woff2
├── src/                    # 源代码
│   ├── main.js             # 入口文件
│   ├── shell.js            # Shell 模块
│   ├── filesystem.js       # 虚拟文件系统
│   ├── commands/           # 命令实现
│   │   ├── ls.js
│   │   ├── cat.js
│   │   ├── cd.js
│   │   ├── tree.js
│   │   └── index.js
│   ├── parser.js           # 命令解析器
│   ├── renderer.js         # Markdown 渲染器
│   └── utils.js            # 工具函数
├── content/                # 文档内容 (Markdown)
│   ├── bio.md
│   ├── papers.md
│   ├── team.md
│   └── help.md
├── assets/                 # 静态资源
│   └── images/
├── package.json            # 项目配置
└── README.md               # 项目说明
```

---

## 5. 实现步骤

### 步骤 1: 项目初始化

```bash
# 创建项目目录
mkdir githubPage
cd githubPage

# 初始化 npm 项目
npm init -y

# 安装依赖
npm install xterm @xterm/addon-fit @xterm/addon-unicode11 marked

# 安装开发依赖
npm install -D vite
```

### 步骤 2: 创建基础 HTML

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Macintosh Terminal</title>
  <link rel="stylesheet" href="/style.css">
  <link rel="stylesheet" href="/macintosh.css">
</head>
<body>
  <div id="app">
    <div id="mac-window">
      <div id="titlebar">
        <div class="window-controls">
          <span class="close"></span>
          <span class="minimize"></span>
          <span class="maximize"></span>
        </div>
        <div class="title">Terminal</div>
      </div>
      <div id="term-host">
        <div id="term-screen"></div>
      </div>
    </div>
  </div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

### 步骤 3: 创建 Macintosh 风格 CSS

```css
/* macintosh.css */

@font-face {
  font-family: 'Chicago';
  src: url('/fonts/Chicago.woff2') format('woff2');
  font-display: swap;
}

:root {
  --mac-bg: #ffffff;
  --mac-fg: #000000;
  --mac-gray: #888888;
  --mac-light-gray: #dddddd;
  --mac-border: #000000;
  --mac-titlebar: #dddddd;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  height: 100%;
  background: #eeeeee;
  font-family: 'Chicago', 'Geneva', 'Monaco', monospace;
}

#app {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

#mac-window {
  width: 100%;
  max-width: 800px;
  height: 90vh;
  background: var(--mac-bg);
  border: 2px solid var(--mac-border);
  box-shadow: 4px 4px 0px var(--mac-fg);
  display: flex;
  flex-direction: column;
}

/* 标题栏 */
#titlebar {
  height: 24px;
  background: var(--mac-titlebar);
  border-bottom: 2px solid var(--mac-border);
  display: flex;
  align-items: center;
  padding: 0 8px;
  gap: 8px;
}

.window-controls {
  display: flex;
  gap: 4px;
}

.window-controls span {
  width: 12px;
  height: 12px;
  border: 1px solid var(--mac-border);
  background: var(--mac-bg);
}

.window-controls .close {
  background: var(--mac-fg);
}

.title {
  flex: 1;
  text-align: center;
  font-size: 12px;
  font-weight: bold;
}

/* 终端区域 */
#term-host {
  flex: 1;
  padding: 16px;
  overflow: hidden;
}

#term-screen {
  height: 100%;
}

/* xterm 自定义 */
.xterm .xterm-rows {
  font-family: 'Chicago', monospace !important;
  font-size: 14px !important;
}

/* 块状光标 */
.xterm .xterm-cursor-layer {
  background-color: var(--mac-fg) !important;
}

/* 选择高亮 */
.xterm .xterm-selection {
  background-color: var(--mac-fg) !important;
  color: var(--mac-bg) !important;
}
```

### 步骤 4: 实现 Shell 核心

```javascript
// src/shell.js

export class Shell {
  constructor(terminal, fileSystem) {
    this.term = terminal;
    this.fs = fileSystem;
    this.buffer = '';
    this.cursor = 0;
    this.history = [];
    this.historyIndex = -1;
    this.commands = new Map();
    
    this.setupInputHandler();
  }

  setupInputHandler() {
    this.term.onData(data => {
      if (this.mode === 'tui') {
        this.tuiInput(data);
        return;
      }

      switch (data) {
        case '\r': // Enter
          this.executeCommand(this.buffer);
          this.buffer = '';
          this.cursor = 0;
          break;
        case '\x7f': // Backspace
          if (this.cursor > 0) {
            this.buffer = this.buffer.slice(0, this.cursor - 1) + 
                         this.buffer.slice(this.cursor);
            this.cursor--;
            this.redrawLine();
          }
          break;
        case '\x1b[A': // Up arrow
          this.historyUp();
          break;
        case '\x1b[B': // Down arrow
          this.historyDown();
          break;
        case '\x1b[D': // Left arrow
          if (this.cursor > 0) {
            this.cursor--;
            this.term.write('\x1b[D');
          }
          break;
        case '\x1b[F': // Right arrow
          if (this.cursor < this.buffer.length) {
            this.cursor++;
            this.term.write('\x1b[C');
          }
          break;
        case '\t': // Tab
          this.autocomplete();
          break;
        case '\x03': // Ctrl-C
          this.term.write('^C\r\n');
          this.buffer = '';
          this.cursor = 0;
          this.showPrompt();
          break;
        case '\x0c': // Ctrl-L
          this.clear();
          break;
        default:
          if (data >= ' ') {
            this.buffer += data;
            this.cursor++;
            this.term.write(data);
          }
      }
    });
  }

  async executeCommand(line) {
    this.term.write('\r\n');
    
    if (!line.trim()) {
      this.showPrompt();
      return;
    }

    this.history.push(line);
    this.historyIndex = this.history.length;

    const [command, ...args] = line.trim().split(/\s+/);
    
    if (this.commands.has(command)) {
      await this.commands.get(command).execute(args, this.fs, this.term);
    } else {
      this.term.write(`Command not found: ${command}\r\n`);
    }

    this.showPrompt();
  }

  showPrompt() {
    const prompt = `Macintosh:${this.fs.cwd} $ `;
    this.term.write(prompt);
  }
}
```

### 步骤 5: 实现虚拟文件系统

```javascript
// src/filesystem.js

export class VirtualFileSystem {
  constructor() {
    this.root = {
      type: 'dir',
      children: {
        'bio': {
          type: 'file',
          content: `# About Me

Hello! I'm a software developer.

## Background
- Computer Science student
- Open source enthusiast
- macOS lover

## Interests
- Operating Systems
- Compilers
- Graphics Programming
`
        },
        'projects': {
          type: 'dir',
          children: {
            'project1.md': {
              type: 'file',
              content: '# Project 1\n\nA cool project...'
            },
            'project2.md': {
              type: 'file',
              content: '# Project 2\n\nAnother cool project...'
            }
          }
        },
        'contact.md': {
          type: 'file',
          content: `# Contact

- Email: your@email.com
- GitHub: github.com/yourusername
- Twitter: @yourusername
`
        },
        'help': {
          type: 'file',
          content: `# Help

## Available Commands

| Command | Description |
|---------|-------------|
| ls      | List files  |
| cat     | View file   |
| cd      | Change dir  |
| pwd     | Print dir   |
| clear   | Clear screen|
| help    | Show help   |
`
        }
      }
    };
    this.cwd = '/';
  }

  resolve(path) {
    if (path === '/') return this.root;
    
    const parts = path.split('/').filter(Boolean);
    let current = this.root;
    
    for (const part of parts) {
      if (part === '..') {
        // 处理上级目录
      } else if (current.type === 'dir' && current.children[part]) {
        current = current.children[part];
      } else {
        return null;
      }
    }
    
    return current;
  }

  ls(path = this.cwd) {
    const target = this.resolve(path);
    if (!target || target.type !== 'dir') {
      return ['Not a directory'];
    }
    return Object.keys(target.children);
  }

  cat(path) {
    const target = this.resolve(path);
    if (!target || target.type !== 'file') {
      return 'Not a file';
    }
    return target.content;
  }

  cd(path) {
    if (path === '~') {
      this.cwd = '/';
      return true;
    }
    
    const target = this.resolve(path);
    if (target && target.type === 'dir') {
      this.cwd = path;
      return true;
    }
    return false;
  }

  pwd() {
    return this.cwd;
  }
}
```

### 步骤 6: 实现命令系统

```javascript
// src/commands/index.js

import { marked } from 'marked';

export function registerCommands(shell, fs) {
  // ls 命令
  shell.commands.set('ls', {
    description: 'List directory contents',
    usage: 'ls [path]',
    execute: async (args, fs, term) => {
      const path = args[0] || fs.cwd;
      const items = fs.ls(path);
      
      // 格式化输出 (类似 ls -l)
      term.write('total ' + items.length + '\r\n');
      items.forEach(item => {
        const target = fs.resolve(path + '/' + item);
        const isDir = target && target.type === 'dir';
        const prefix = isDir ? 'd' : '-';
        const suffix = isDir ? '/' : '';
        term.write(`${prefix}r--r--r--  ${item}${suffix}\r\n`);
      });
    }
  });

  // cat 命令
  shell.commands.set('cat', {
    description: 'Display file contents',
    usage: 'cat <file>',
    execute: async (args, fs, term) => {
      if (!args[0]) {
        term.write('Usage: cat <file>\r\n');
        return;
      }
      
      const content = fs.cat(args[0]);
      if (content === 'Not a file') {
        term.write(`cat: ${args[0]}: No such file\r\n`);
      } else {
        // 渲染 Markdown
        const rendered = marked(content);
        term.write(rendered + '\r\n');
      }
    }
  });

  // cd 命令
  shell.commands.set('cd', {
    description: 'Change directory',
    usage: 'cd <path>',
    execute: async (args, fs, term) => {
      const path = args[0] || '~';
      if (!fs.cd(path)) {
        term.write(`cd: no such file or directory: ${path}\r\n`);
      }
    }
  });

  // pwd 命令
  shell.commands.set('pwd', {
    description: 'Print working directory',
    usage: 'pwd',
    execute: async (args, fs, term) => {
      term.write(fs.pwd() + '\r\n');
    }
  });

  // clear 命令
  shell.commands.set('clear', {
    description: 'Clear the screen',
    usage: 'clear',
    execute: async (args, fs, term) => {
      term.write('\x1b[2J\x1b[3J\x1b[H');
    }
  });

  // help 命令
  shell.commands.set('help', {
    description: 'Show help message',
    usage: 'help',
    execute: async (args, fs, term) => {
      const help = fs.cat('/help');
      term.write(help + '\r\n');
    }
  });

  // tree 命令
  shell.commands.set('tree', {
    description: 'Display directory tree',
    usage: 'tree [path]',
    execute: async (args, fs, term) => {
      const path = args[0] || '.';
      const tree = generateTree(fs, path);
      term.write(tree + '\r\n');
    }
  });
}

function generateTree(fs, path, prefix = '') {
  const items = fs.ls(path);
  let result = '';
  
  items.forEach((item, index) => {
    const isLast = index === items.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const target = fs.resolve(path + '/' + item);
    const isDir = target && target.type === 'dir';
    const suffix = isDir ? '/' : '';
    
    result += prefix + connector + item + suffix + '\n';
    
    if (isDir) {
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      result += generateTree(fs, path + '/' + item, newPrefix);
    }
  });
  
  return result;
}
```

### 步骤 7: 初始化应用

```javascript
// src/main.js

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { Shell } from './shell.js';
import { VirtualFileSystem } from './filesystem.js';
import { registerCommands } from './commands/index.js';

import '@xterm/xterm/css/xterm.css';

// 等待字体加载
document.fonts.ready.then(() => {
  init();
});

function init() {
  // 创建终端实例
  const term = new Terminal({
    fontFamily: "'Chicago', 'Geneva', 'Monaco', monospace",
    fontSize: 14,
    lineHeight: 1.2,
    cursorBlink: true,
    cursorStyle: 'block',
    theme: {
      background: '#ffffff',
      foreground: '#000000',
      cursor: '#000000',
      selectionBackground: '#000000',
      selectionForeground: '#ffffff'
    }
  });

  // 安装插件
  const fitAddon = new FitAddon();
  const unicodeAddon = new Unicode11Addon();
  term.loadAddon(fitAddon);
  term.loadAddon(unicodeAddon);

  // 挂载终端
  term.open(document.getElementById('term-screen'));
  fitAddon.fit();

  // 自适应窗口大小
  const resizeObserver = new ResizeObserver(() => {
    fitAddon.fit();
  });
  resizeObserver.observe(document.getElementById('term-host'));

  // 初始化文件系统
  const fs = new VirtualFileSystem();

  // 初始化 Shell
  const shell = new Shell(term, fs);

  // 注册命令
  registerCommands(shell, fs);

  // 显示启动信息
  showBootScreen(term);

  // 启动 Shell
  shell.start();
}

function showBootScreen(term) {
  const bootMessage = `
Macintosh Terminal v1.0
======================

Welcome to Macintosh.
Type "help" for available commands.

`;
  term.write(bootMessage);
}
```

---

## 6. 核心代码实现

### 6.1 增强的 Shell 实现

```javascript
// src/shell-enhanced.js

export class EnhancedShell {
  constructor(terminal, fileSystem) {
    this.term = terminal;
    this.fs = fileSystem;
    this.buffer = '';
    this.cursor = 0;
    this.history = [];
    this.historyIndex = -1;
    this.commands = new Map();
    this.mode = 'shell';
    this.prompt = 'Macintosh';
    
    this.setupInputHandler();
    this.setupTabCompletion();
  }

  setupInputHandler() {
    this.term.onData(async data => {
      if (this.mode === 'tui') {
        this.handleTuiInput(data);
        return;
      }

      await this.handleShellInput(data);
    });
  }

  async handleShellInput(data) {
    // Ctrl 键组合
    if (data.charCodeAt(0) < 32) {
      await this.handleControlKey(data);
      return;
    }

    // 特殊按键
    if (data.startsWith('\x1b')) {
      await this.handleSpecialKey(data);
      return;
    }

    // 普通字符
    if (data >= ' ') {
      this.insertChar(data);
    }
  }

  async handleControlKey(data) {
    const code = data.charCodeAt(0);
    
    switch (code) {
      case 3: // Ctrl-C
        this.term.write('^C\r\n');
        this.buffer = '';
        this.cursor = 0;
        this.showPrompt();
        break;
        
      case 4: // Ctrl-D
        if (this.buffer.length === 0) {
          this.term.write('\r\nGoodbye!\r\n');
          // 可选: 关闭终端或重定向
        } else {
          this.deleteCharForward();
        }
        break;
        
      case 7: // Ctrl-G (BEL)
        this.term.write('\x07');
        break;
        
      case 8: // Ctrl-H (Backspace)
        this.deleteCharBackward();
        break;
        
      case 11: // Ctrl-K
        this.killToEnd();
        break;
        
      case 12: // Ctrl-L
        this.clearScreen();
        break;
        
      case 21: // Ctrl-U
        this.killToStart();
        break;
        
      case 23: // Ctrl-W
        this.deleteWordBackward();
        break;
    }
  }

  async handleSpecialKey(data) {
    switch (data) {
      case '\x1b[A': // Up
        this.historyUp();
        break;
      case '\x1b[B': // Down
        this.historyDown();
        break;
      case '\x1b[D': // Left
        this.moveCursorLeft();
        break;
      case '\x1b[C': // Right
        this.moveCursorRight();
        break;
      case '\x1b[H': // Home
        this.moveToStart();
        break;
      case '\x1b[F': // End
        this.moveToEnd();
        break;
      case '\x1b[3~': // Delete
        this.deleteCharForward();
        break;
      case '\t': // Tab
        await this.autocomplete();
        break;
      case '\r': // Enter
        await this.executeCommand();
        break;
    }
  }

  insertChar(char) {
    this.buffer = this.buffer.slice(0, this.cursor) + char + 
                  this.buffer.slice(this.cursor);
    this.cursor++;
    this.redrawFromCursor();
  }

  deleteCharBackward() {
    if (this.cursor === 0) return;
    
    this.buffer = this.buffer.slice(0, this.cursor - 1) + 
                  this.buffer.slice(this.cursor);
    this.cursor--;
    this.redrawLine();
  }

  deleteCharForward() {
    if (this.cursor >= this.buffer.length) return;
    
    this.buffer = this.buffer.slice(0, this.cursor) + 
                  this.buffer.slice(this.cursor + 1);
    this.redrawLine();
  }

  moveCursorLeft() {
    if (this.cursor === 0) return;
    this.cursor--;
    this.term.write('\x1b[D');
  }

  moveCursorRight() {
    if (this.cursor >= this.buffer.length) return;
    this.cursor++;
    this.term.write('\x1b[C');
  }

  moveToStart() {
    while (this.cursor > 0) {
      this.cursor--;
      this.term.write('\x1b[D');
    }
  }

  moveToEnd() {
    while (this.cursor < this.buffer.length) {
      this.cursor++;
      this.term.write('\x1b[C');
    }
  }

  redrawLine() {
    // 清除当前行
    this.term.write('\x1b[2K');
    this.term.write('\r');
    this.showPrompt();
    this.term.write(this.buffer);
    
    // 重置光标位置
    const promptLength = this.getPromptLength();
    const targetCol = promptLength + this.cursor;
    this.term.write(`\x1b[${targetCol}G`);
  }

  redrawFromCursor() {
    // 从光标位置开始重绘
    const remaining = this.buffer.slice(this.cursor);
    this.term.write(remaining);
    
    // 移动光标回原位
    if (remaining.length > 0) {
      this.term.write(`\x1b[${remaining.length}D`);
    }
  }

  async autocomplete() {
    const words = this.buffer.slice(0, this.cursor).split(/\s+/);
    const partial = words[words.length - 1];
    
    if (!partial) return;
    
    // 获取补全候选
    const candidates = this.getCandidates(partial);
    
    if (candidates.length === 0) {
      this.term.write('\x07'); // BEL
    } else if (candidates.length === 1) {
      // 唯一匹配，直接补全
      const completion = candidates[0];
      const suffix = this.fs.isDir(completion) ? '/' : ' ';
      const remaining = completion.slice(partial.length) + suffix;
      
      this.buffer = this.buffer.slice(0, this.cursor) + remaining + 
                    this.buffer.slice(this.cursor);
      this.cursor += remaining.length;
      this.term.write(remaining);
    } else {
      // 多个匹配，显示候选
      this.term.write('\r\n');
      this.term.write(candidates.join('  ') + '\r\n');
      this.showPrompt();
      this.term.write(this.buffer);
    }
  }

  getCandidates(partial) {
    const candidates = [];
    
    // 检查命令
    for (const cmd of this.commands.keys()) {
      if (cmd.startsWith(partial)) {
        candidates.push(cmd);
      }
    }
    
    // 检查当前目录的文件
    const files = this.fs.ls(this.fs.cwd);
    for (const file of files) {
      if (file.startsWith(partial)) {
        candidates.push(file);
      }
    }
    
    return candidates;
  }

  historyUp() {
    if (this.historyIndex === 0) return;
    
    this.historyIndex--;
    this.buffer = this.history[this.historyIndex];
    this.cursor = this.buffer.length;
    this.redrawLine();
  }

  historyDown() {
    if (this.historyIndex >= this.history.length - 1) {
      this.historyIndex = this.history.length;
      this.buffer = '';
      this.cursor = 0;
      this.redrawLine();
      return;
    }
    
    this.historyIndex++;
    this.buffer = this.history[this.historyIndex];
    this.cursor = this.buffer.length;
    this.redrawLine();
  }

  async executeCommand() {
    this.term.write('\r\n');
    
    const line = this.buffer.trim();
    this.buffer = '';
    this.cursor = 0;
    
    if (!line) {
      this.showPrompt();
      return;
    }
    
    // 保存到历史
    this.history.push(line);
    this.historyIndex = this.history.length;
    
    // 解析命令 (支持管道)
    const pipelines = this.parsePipelines(line);
    
    for (const pipeline of pipelines) {
      await this.executePipeline(pipeline);
    }
    
    this.showPrompt();
  }

  parsePipelines(line) {
    return line.split('|').map(cmd => cmd.trim());
  }

  async executePipeline(commands) {
    let input = '';
    
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      const [name, ...args] = cmd.split(/\s+/);
      
      if (!this.commands.has(name)) {
        this.term.write(`${name}: command not found\r\n`);
        return;
      }
      
      const stdout = { write: (text) => { input += text; } };
      
      if (i === commands.length - 1) {
        // 最后一个命令输出到终端
        stdout.write = (text) => this.term.write(text);
      }
      
      await this.commands.get(name).execute(args, this.fs, stdout, input);
    }
  }

  showPrompt() {
    const cwd = this.fs.cwd === '/' ? '~' : this.fs.cwd;
    this.term.write(`${this.prompt}:${cwd} $ `);
  }

  clearScreen() {
    this.term.write('\x1b[2J\x1b[3J\x1b[H');
  }

  killToEnd() {
    const remaining = this.buffer.slice(this.cursor);
    this.buffer = this.buffer.slice(0, this.cursor);
    this.term.write('\x1b[K');
  }

  killToStart() {
    this.buffer = this.buffer.slice(this.cursor);
    this.cursor = 0;
    this.redrawLine();
  }

  deleteWordBackward() {
    const before = this.buffer.slice(0, this.cursor);
    const after = this.buffer.slice(this.cursor);
    
    const newBefore = before.replace(/\S+\s*$/, '');
    const deleted = before.slice(newBefore.length);
    
    this.buffer = newBefore + after;
    this.cursor = newBefore.length;
    
    this.term.write('\x1b[2K');
    this.term.write('\r');
    this.showPrompt();
    this.term.write(this.buffer);
    
    const promptLength = this.getPromptLength();
    this.term.write(`\x1b[${promptLength + this.cursor}G`);
  }

  getPromptLength() {
    const cwd = this.fs.cwd === '/' ? '~' : this.fs.cwd;
    return `${this.prompt}:${cwd} $ `.length;
  }
}
```

### 6.2 增强的文件系统

```javascript
// src/filesystem-enhanced.js

export class EnhancedFileSystem {
  constructor() {
    this.root = this.createInitialFileSystem();
    this.cwd = '/';
    this.home = '/Users/you';
  }

  createInitialFileSystem() {
    return {
      type: 'dir',
      children: {
        'Applications': {
          type: 'dir',
          children: {
            'Terminal.app': { type: 'file', content: 'Terminal Application' },
            'TextEdit.app': { type: 'file', content: 'Text Editor' }
          }
        },
        'System': {
          type: 'dir',
          children: {
            'Library': { type: 'dir', children: {} }
          }
        },
        'Users': {
          type: 'dir',
          children: {
            'you': {
              type: 'dir',
              children: {
                'Desktop': { type: 'dir', children: {} },
                'Documents': {
                  type: 'dir',
                  children: {
                    'bio.md': {
                      type: 'file',
                      content: `# About Me

Hello! I'm a software developer passionate about creating beautiful and functional applications.

## Background

- **Education**: Computer Science
- **Location**: San Francisco, CA
- **Interests**: OS Development, Graphics Programming, UI Design

## Skills

- JavaScript / TypeScript
- Rust / C++
- Python
- Web Development
- System Programming

## Contact

- Email: hello@example.com
- GitHub: github.com/yourusername
`
                    },
                    'projects.md': {
                      type: 'file',
                      content: `# My Projects

## Project 1: Terminal Emulator

A retro-style terminal emulator for the web.

## Project 2: Operating System

A small hobby OS written in Rust.

## Project 3: Graphics Engine

A 2D/3D graphics engine for games.
`
                    }
                  }
                },
                'Downloads': { type: 'dir', children: {} },
                'Pictures': { type: 'dir', children: {} },
                'readme.txt': {
                  type: 'file',
                  content: `Welcome to Macintosh!

This is a simulated Macintosh terminal.
Type "help" to see available commands.

Think Different.
`
                }
              }
            }
          }
        },
        'bin': {
          type: 'dir',
          children: {
            'ls': { type: 'file', content: 'list directory' },
            'cat': { type: 'file', content: 'concatenate files' },
            'cd': { type: 'file', content: 'change directory' },
            'pwd': { type: 'file', content: 'print working directory' },
            'clear': { type: 'file', content: 'clear screen' },
            'tree': { type: 'file', content: 'display directory tree' },
            'help': { type: 'file', content: 'display help' }
          }
        },
        'help.txt': {
          type: 'file',
          content: `Macintosh Terminal v1.0
======================

Available Commands:

  ls [path]        List directory contents
  cat <file>       Display file contents
  cd <path>        Change directory
  pwd              Print working directory
  tree [path]      Display directory tree
  clear            Clear the screen
  help             Show this help message
  history          Show command history
  about            About this Mac
  date             Show current date/time

Navigation:
  cd ~             Go to home directory
  cd ..            Go to parent directory
  cd /             Go to root directory

Keyboard Shortcuts:
  Ctrl-C           Cancel current command
  Ctrl-L           Clear screen
  Ctrl-A           Move to start of line
  Ctrl-E           Move to end of line
  Ctrl-U           Clear line
  Ctrl-K           Kill to end of line
  Ctrl-W           Delete word backward
  Tab              Autocomplete

Think Different.
`
        }
      }
    };
  }

  // ... 其他方法保持不变
}
```

### 6.3 Markdown 渲染器

```javascript
// src/renderer.js

import { marked } from 'marked';

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true
});

export function renderMarkdown(content, format = 'terminal') {
  if (format === 'terminal') {
    return renderToTerminal(content);
  }
  return marked(content);
}

function renderToTerminal(content) {
  const tokens = marked.lexer(content);
  let output = '';

  for (const token of tokens) {
    switch (token.type) {
      case 'heading':
        output += renderHeading(token);
        break;
      case 'paragraph':
        output += renderParagraph(token);
        break;
      case 'list':
        output += renderList(token);
        break;
      case 'code':
        output += renderCode(token);
        break;
      case 'blockquote':
        output += renderBlockquote(token);
        break;
      case 'table':
        output += renderTable(token);
        break;
      case 'hr':
        output += '─'.repeat(40) + '\r\n';
        break;
      default:
        output += token.raw + '\r\n';
    }
  }

  return output;
}

function renderHeading(token) {
  const text = token.text;
  const level = token.depth;
  
  let prefix = '';
  let suffix = '';
  
  switch (level) {
    case 1:
      prefix = '\r\n\x1b[1m\x1b[4m'; // Bold + Underline
      suffix = '\x1b[0m\r\n' + '═'.repeat(text.length + 2) + '\r\n';
      break;
    case 2:
      prefix = '\r\n\x1b[1m'; // Bold
      suffix = '\x1b[0m\r\n' + '─'.repeat(text.length + 2) + '\r\n';
      break;
    case 3:
      prefix = '\r\n\x1b[1m'; // Bold
      suffix = '\x1b[0m\r\n';
      break;
    default:
      prefix = '\r\n';
      suffix = '\r\n';
  }
  
  return prefix + ' ' + text + ' ' + suffix;
}

function renderParagraph(token) {
  return token.text + '\r\n\r\n';
}

function renderList(token) {
  let output = '';
  
  for (const item of token.items) {
    const bullet = token.ordered ? `${item.index}. ` : '• ';
    output += bullet + item.text + '\r\n';
    
    if (item.tokens) {
      for (const subToken of item.tokens) {
        if (subToken.type === 'list') {
          output += '  ' + renderList(subToken).replace(/\n/g, '\n  ');
        }
      }
    }
  }
  
  return output + '\r\n';
}

function renderCode(token) {
  let output = '\r\n\x1b[48;5;236m'; // Dark background
  
  const lines = token.text.split('\n');
  for (const line of lines) {
    output += '  ' + line + '\r\n';
  }
  
  output += '\x1b[0m\r\n';
  return output;
}

function renderBlockquote(token) {
  let output = '\r\n\x1b[3m'; // Italic
  
  for (const line of token.text.split('\n')) {
    output += '  │ ' + line + '\r\n';
  }
  
  output += '\x1b[0m\r\n';
  return output;
}

function renderTable(token) {
  let output = '\r\n';
  
  // 表头
  const header = token.header;
  const separator = token.align;
  
  output += '┌';
  for (let i = 0; i < header.length; i++) {
    const width = Math.max(header[i].length, 10);
    output += '─'.repeat(width + 2);
    output += i < header.length - 1 ? '┬' : '┐';
  }
  output += '\r\n';
  
  output += '│';
  for (let i = 0; i < header.length; i++) {
    const width = Math.max(header[i].length, 10);
    output += ' ' + header[i].padEnd(width) + ' │';
  }
  output += '\r\n';
  
  output += '├';
  for (let i = 0; i < header.length; i++) {
    const width = Math.max(header[i].length, 10);
    output += '─'.repeat(width + 2);
    output += i < header.length - 1 ? '┼' : '┤';
  }
  output += '\r\n';
  
  // 数据行
  for (const row of token.rows) {
    output += '│';
    for (let i = 0; i < row.length; i++) {
      const width = Math.max(header[i].length, 10);
      output += ' ' + row[i].padEnd(width) + ' │';
    }
    output += '\r\n';
  }
  
  output += '└';
  for (let i = 0; i < header.length; i++) {
    const width = Math.max(header[i].length, 10);
    output += '─'.repeat(width + 2);
    output += i < header.length - 1 ? '┴' : '┘';
  }
  output += '\r\n\r\n';
  
  return output;
}
```

---

## 7. 部署说明

### 7.1 GitHub Pages 部署

1. **创建仓库**
   ```bash
   # 在 GitHub 上创建新仓库
   # 仓库名: yourusername.github.io
   ```

2. **推送代码**
   ```bash
   cd githubPage
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/yourusername.github.io.git
   git push -u origin main
   ```

3. **启用 GitHub Pages**
   - 进入仓库 Settings → Pages
   - Source 选择 "Deploy from a branch"
   - Branch 选择 "main" / "/ (root)"
   - 保存

4. **访问网站**
   - 等待几分钟后访问: `https://yourusername.github.io`

### 7.2 自定义域名 (可选)

1. 购买域名
2. 在 DNS 提供商处添加 CNAME 记录:
   ```
   www  CNAME  yourusername.github.io
   ```
3. 在仓库根目录创建 `CNAME` 文件:
   ```
   www.yourdomain.com
   ```
4. 在 Settings → Pages 中启用 HTTPS

### 7.3 性能优化

```javascript
// 延迟加载 xterm.js
const loadTerminal = async () => {
  const { Terminal } = await import('@xterm/xterm');
  // ...
};

// 预加载字体
document.fonts.load('14px Chicago').then(() => {
  console.log('Chicago font loaded');
});

// Service Worker 缓存
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

---

## 附录

### A. 资源链接

- [xterm.js 文档](https://xtermjs.org/docs/)
- [marked.js 文档](https://marked.js.org/)
- [Oldschool PC Fonts](https://int10h.org/oldschool-pc-fonts/)
- [ChicagoFLF - Google Fonts](https://fonts.google.com/specimen/ChicagoFLF)
- [GitHub Pages 文档](https://docs.github.com/en/pages)

### B. 灵感来源

- [蒋炎岩个人主页](https://jiangyy.github.io/)
- [McHacking](https://mchacking.org/)
- [Classic Mac OS](https://en.wikipedia.org/wiki/Classic_Mac_OS)
- [1984 Macintosh Launch](https://www.youtube.com/watch?v=2B-XoPvFd98)

### C. 扩展功能建议

1. **多窗口支持** - 允许打开多个终端窗口
2. **窗口拖拽** - 支持拖拽移动窗口
3. **菜单栏** - 添加经典的 Mac 菜单栏
4. **图标系统** - 为文件和应用添加图标
5. **声音效果** - 添加经典的 Mac 系统音效
6. **暗色模式** - 支持 System 7 风格的暗色主题
7. **打印机模拟** - 模拟经典的 ImageWriter 打印机

---

**Remember: Think Different.**

*Made with ❤️ for the Macintosh community*
