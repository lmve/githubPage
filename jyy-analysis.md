# jyy 个人主页项目深度解析

> 目标项目：<https://jiangyy.github.io/> · 源码：<https://github.com/jiangyy/jiangyy.github.io>
> 一句话概括：**一个假装成 Unix 终端、但架构上完全是一个内容系统的静态个人主页。**

---

## 目录

1. [项目总览](#1-项目总览)
2. [架构：四层解耦](#2-架构四层解耦)
3. [值得学习的设计](#3-值得学习的设计)
4. [值得思考的取舍与哲学](#4-值得思考的取舍与哲学)
5. [细节亮点](#5-细节亮点)
6. [局限与可改进之处](#6-局限与可改进之处)
7. [可借鉴清单](#7-可借鉴清单)

---

## 1. 项目总览

这是一个用 **xterm.js + 一个自研迷你 shell** 实现的静态个人主页。所有内容都是 markdown 文件，构建期被编译成一个结构化清单，运行时由 shell 层把它们当作"命令"和"文件系统"呈现出来。

技术栈（`package.json`）：

| 层 | 技术 |
|---|---|
| 终端引擎 | `@xterm/xterm` 5.5 |
| 内容解析 | `marked` 18（只用 `lexer`，不用它的 HTML 渲染器） |
| 构建 | `vite` 8 + 自研 `contentPlugin` |
| 语言 | TypeScript（严格模式），编译脚本用 `tsx` 运行 |
| 测试 | `node:test` 内置测试框架 |
| 部署 | `gh-pages` 推到 `gh-pages` 分支 |

代码量很小——`src/` 下不到 30 个文件，但每个文件职责极其单一、注释极其到位。

---

## 2. 架构：四层解耦

README 里这张图是理解整个项目的钥匙：

```
content/*.md ──[compiler]──▶ src/generated/content.ts (manifest)
                                    │
index.html ──vite──▶ dist/           ▼
                      runtime:   main.ts
                        ├─ term/     xterm.js 封装 + ANSI/TUI 原语 + OSC8 链接
                        ├─ shell/    Registry + Parser + REPL (管道/历史/补全/inject)
                        ├─ content/  清单 store + markdown→ANSI 渲染器 + 文档命令
                        └─ apps/     一次性命令 & TUI 命令，插件式注册
```

四个关键分层原则：

### 2.1 content 层：纯 markdown，零元数据

`content/` 目录里只有 `.md` 文件。**没有 frontmatter、没有 shebang、没有任何类型标记**。目录结构本身就是信息架构：

```
content/
  index.md          → 命令 "index"
  bio.md            → 命令 "bio"
  papers.md         → 命令 "papers"
  blog/hello.md     → 命令 "blog/hello"（隐式产生 blog/ 目录）
```

文件路径 `blog/hello.md` 的路径 `blog/hello` 就是它的身份（slug）。这个设计让**内容作者完全不用懂代码**，添加一页 = 加一个 md 文件。

### 2.2 compiler 层：独立可运行的构建脚本

`scripts/build-content.ts` 是一个**可以单独运行**的编译器（`npm run build:content`），它：

1. 递归遍历 `content/**/*.md`
2. 展开宏（`{{displayDate(...)}}`、`{{texify(...)}}`）
3. 提取第一个 `# h1` 作为标题
4. 生成 `src/generated/content.ts` 这个"清单"文件

关键：`buildContent()` 是纯函数，`build-content.ts` 里唯一的副作用是末尾写文件。vite 插件（`content-plugin.ts`）只是**复用**这个编译器，在 dev 时监听 `content/` 变化自动重编译。

这种"编译器独立于框架"的做法，让内容管线可以脱离 vite 单独测试、单独演进。

### 2.3 framework 层：完全不知道 markdown 的存在

`term/` 和 `shell/` 两个目录**从不 import 任何 content 相关的东西**。它们只依赖 `shell/types.ts` 里定义的契约：

```ts
interface Command {
  run(ctx: Context, argv: Argv): Promise<void>;
}
interface Context {
  term: Term;
  store: ContentStore;   // 唯一的 content 依赖，且被抽象成接口
  stdin: string;          // 管道上游输入
  stdout: StdOut;         // 输出 sink（终端 or 内存 buffer）
  tty: boolean;           // 是否输出到真终端
  cwd: string;
  resolve(name): Command | undefined;
  list(): Command[];
  chdir(target): string | null;
  listDir(target): DirEntry[] | null;
}
```

### 2.4 apps 层：一个文件一个命令

每个 `apps/*.ts` 导出一个 `Command` 对象，在 `apps/index.ts` 里集中注册：

```ts
export const builtinApps: Command[] = [
  ls, cat, head, tail, grep, find, tree, more, less,
  cd, pwd, wc, clear, exit, whoami,
];
```

加一个新命令 = 写一个文件 + 加一行注册。**没有别的改动点。**

---

## 3. 值得学习的设计

### 3.1 "文档即命令"——用 Unix 心智模型组织内容

这是全项目最妙的一笔。每个 markdown 文档同时被注册成一个命令：

```ts
// src/content/commands.ts
export function docCommand(doc: Document): Command {
  return {
    name: doc.slug,
    doc: true,
    async run(ctx) {
      switch (doc.kind) {
        case 'page':
          await renderDoc(ctx, doc);   // 清屏 + 渲染
          return;
        default:
          // 未来 LLM 驱动的交互式文档处理器
      }
    },
  };
}
```

于是：

- 输入 `bio` → **执行**这个文档（清屏、全屏渲染）
- 输入 `cat bio` → **读取**这个文档（只打印，不清屏，可进管道）

"打开页面"和"读取文件"这两个语义被精确区分开：`bio` 是导航动作，`cat bio` 是数据操作。前者清屏，后者可以 `cat bio | wc -l`。这种语义精确性值得深思——**很多系统的"打开"和"读取"是不分的，这里用 Unix 传统把它们分开了。**

### 3.2 虚拟文件系统：从 slug 推导出目录树

没有真实的目录结构，`shell/vfs.ts` 用 slug 的 `/` 分隔符**推导**出目录：

```ts
// isDir: 某个 slug 是目录，当且仅当有文档以 "slug/" 开头
export function isDir(slug, ctx) {
  if (slug === '' || slug === 'bin') return true;
  return ctx.store.all().some((d) => d.slug.startsWith(slug + '/'));
}
```

`childrenOf` 通过遍历所有 slug 的前缀，把 `blog/hello`、`blog/world` 归约成一个隐式的 `blog/` 目录。**`/bin` 目录是虚拟的**——它是"所有非内建、非文档命令"的集合。

这个设计的洞察在于：**目录结构不是存储出来的，是计算出来的。** 内容只关心自己是"一篇文章"，目录是路径命名自然涌现的结果。

### 3.3 统一命令契约 + 管道 = 极简的组合能力

管道的实现只有不到 20 行（`shell/shell.ts` 的 `execute`）：

```ts
let stdin = '';
for (const segment of segments) {
  const isLast = i === segments.length - 1;
  let buffer = '';
  const stdout = isLast
    ? { write: s => term.write(s), ... }       // 最后一段：写终端
    : { write: s => void (buffer += s), ... };  // 中间段：写内存 buffer
  await cmd.run(ctx, argv);
  stdin = buffer;   // 上游 stdout 变成下游 stdin
}
```

命令**完全不知道自己是否在管道里**，它只是读 `ctx.stdin`、写 `ctx.stdout`。`wc`、`grep`、`more` 都同时支持"读文件"和"读 stdin"两种模式，管道能力是免费得到的。

这是 **Unix 哲学"每个程序做一件事，通过文本流组合"的忠实再现**，但把复杂度压到了极致。

### 3.4 终端双模式：一次性命令和 TUI 命令共用一套机制

`term.ts` 里最精彩的是 `takeOver()` / `release()`：

```ts
takeOver(): TuiSession {
  this.mode = 'tui';
  return {
    onKey: cb => { this.tuiKeyCb = cb; },
    release: () => { this.mode = 'shell'; },
    // ...
  };
}
```

- **shell 模式**：`onData` 把原始字节流交给 shell 做行编辑
- **tui 模式**：`onKey` 把键盘事件交给分页器独占

`more` 的实现（`apps/more.ts`）在 `await page()` 里接管终端，绘制、响应按键，最后 `release()` 交还。因为 `shell` 的 `execute` 是 `await cmd.run(...)`，**shell 和分页器天然不会争抢输入**——这个用 async/await 解耦并发输入的思路非常干净。

### 3.5 构建期宏系统：把复杂性留在编译期

`scripts/macros.ts` 在**构建时**展开 `{{...}}` 宏，部署产物里只有纯文本：

- `{{displayDate(2026, 7, 31)}}` → `Fri Jul 31 2026`（自动推算星期几）
- `{{texify(e=mc^2)}}` → `e=mc²`

而 `scripts/tex.ts` 是一个**终端友好的数学渲染器**：把一个 LaTeX 子集（希腊字母、上下标、`\frac`）翻译成 Unicode 文本：

```
\frac{a}{b}  →  a
                ─
                b
```

这两件事都值得学习：

1. **把运行时依赖变成构建期展开**——用户下载的是最终文本，不需要解析器。
2. **在一个字符网格上渲染数学**——用 Unicode 上下标（`²`、`ⁿ`）和 Unicode 分数线（`─`）在终端里"排版"公式，这是对终端作为显示媒介的深刻理解。

### 3.6 内容管线为未来 LLM 预留了 hook

`build-content.ts` 里的 `analyze()` 函数，现在是空壳：

```ts
function analyze(_body: string): { kind: string; apps: AppDecl[] } {
  return { kind: 'page', apps: [] };
}
```

但注释写得很清楚：**这是未来 LLM 驱动的决策点**——把文档正文作为 prompt，让模型决定它是静态页面还是可执行的 TUI 应用。`types.ts` 里已经预留了 `AppDecl`（`<!-- tui:app -->` 指令）和 `kind` 字段。

这种"**今天实现一个平凡规则，但把接口留成未来可扩展点**"的工程判断，非常值得学习。

---

## 4. 值得思考的取舍与哲学

### 4.1 为什么不用一个真实 shell，而是自研迷你 shell？

技术上完全可以把 xterm 连到 node-pty 跑一个真 zsh。但作者选择自己实现。原因值得想清楚：

- **可控性**：真实 shell 会引入安全风险（`rm -rf`）、不可预测的输入输出、巨大的依赖。
- **足够性**：个人主页只需要"浏览内容"这一件事，一个 30 个命令的迷你 shell 完全够。
- **可预测性**：每一条命令的行为都是确定的，没有环境差异。

**这是"做减法"的典范：不是实现一个通用工具，而是实现一个刚好够用的工具。**

### 4.2 约束是有意的

看这些命令的"故意简陋"：

- `grep` 没有 `-i`/`-v`/`-n`，所有 `-` 开头的参数直接忽略
- `find` 只支持 `-name` 和 `-type`，未知选项忽略
- `wc` 用 `text.length`（UTF-16 码元）而非真正的 UTF-8 字节数

这些不是偷懒，是**有意的边界**。注释里都写明了。一个个人主页不需要完整的 POSIX 语义，保持简单让每个文件在 30-90 行内读完。

### 4.3 能在构建期做的，绝不留到运行时

整个内容管线（宏展开、markdown→清单、math 渲染）全部在构建期完成。运行时只剩：

- 一个 xterm 实例
- 一个迷你 shell
- 一个 ANSI 渲染器

带来的好处：**部署产物是纯静态的**（可以 curl 读到内容、无 JS 也能看）、运行时更小更快、没有运行时解析错误。

### 4.4 渐进增强：即使是"终端"，也考虑无 JS 环境

`content-plugin.ts` 的 `transformIndexHtml` 会把 home 页的正文内联进 `<noscript>`：

```ts
transformIndexHtml() {
  const text = homeBody.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return [{ tag: 'noscript', children: `<pre>${text}</pre>` }];
}
```

所以 `curl https://jiangyy.github.io/` 能直接读到内容，没有 JS 的客户端也能看到主页。**一个表面上是"终端模拟器"的项目，底层仍然尊重 web 的渐进增强原则**——这种克制很难得。

### 4.5 哈希路由让"返回键"在终端里也能工作

内部链接（如首页的 `[Bio](#bio)`）点击后走 `history.pushState` + 注入命令，而不是直接执行：

```ts
// src/main.ts
const term = new Term(termScreen, (cmd) => {
  history.pushState({ cmd }, '', '#' + cmd);
  shell.inject(cmd);
});
```

这样 `#bio` 会出现在 URL 里，浏览器"返回"键能回到上一页。**终端交互和 web 导航模型被统一了**——这在大多数"终端风格主页"里是被忽略的细节。

---

## 5. 细节亮点

### 5.1 字符宽度的正确性（`term/ansi.ts`）

终端是字符网格，中文字符宽 2 格、emoji 可能由 ZWJ 连接多个码点。`ansi.ts` 实现了完整的 `displayWidth`，处理：

- 零宽连接符（ZWJ）连接的 emoji 家族（👨‍👩‍👧 算一个 cluster）
- 变体选择器、肤色修饰符
- 国旗（两个 regional indicator 算一个 2 格字符）
- 组合变音符号

而 `prevClusterStart`/`nextClusterEnd` 让**退格删除的是整个 grapheme cluster，而不是半个 emoji**。这些细节让行编辑器在中文/emoji 输入下不闪烁、不破格。

### 5.2 换行不切断 ANSI 序列（`term/wrap.ts`）

markdown 渲染出带 SGR 样式的字符串后，分页器需要按终端宽度软换行。`wrap.ts` 先把字符串 `tokenize` 成 `sgr`/`osc`/`ch` 三类 token，换行时：

- 绝不在一个转义序列中间断行
- 跨行时重新发射当前活跃的 SGR（样式和 OSC 8 链接在换行后仍然有效）

这是终端渲染里最容易出 bug 的地方（断行导致样式泄漏或丢失），作者处理得一丝不苟。

### 5.3 markdown → ANSI 用 token 流而非 HTML

`render.ts` 用 `marked.lexer(body)` 拿到 **token 流**，自己写渲染，而不是用 `marked.parse` 出 HTML 再转 ANSI。好处：

- 完全掌控输出（不引入 HTML 语义的包袱）
- 链接用 OSC 8 协议（`\x1b]8;;url\x1b\\`）渲染，在 xterm 里**真正可点击**
- 标题、列表、代码块、表格、引用都能映射到合适的 ANSI 样式

### 5.4 CRT 视觉效果的克制实现

首页的"老式打字机"质感来自三个纯 CSS/SVG 层（`index.html` + `style.css`）：

1. SVG `feTurbulence` + `feDisplacementMap` 做像素微错位（文字仍清晰，只是"颗粒感"）
2. `repeating-linear-gradient` 做扫描线
3. `radial-gradient` 做暗角

而且整个 `#term-host` 初始 `opacity: 0`，等字体加载、终端 fit 完成后才 `opacity: 1`——**规避了 web font 加载导致的布局闪烁（FOUT）**。`max-width: calc(80ch + 38px)` 精确限制列宽，让 `FitAddon` 测出正确的 80 列。

---

## 6. 局限与可改进之处

批判性地看，也有值得商榷的地方：

1. **虚拟 FS 是扁平映射，非真树**：`childrenOf` 每次都要遍历全部 slug 推导目录。对几十篇文档没问题，但若内容量到成千上万，是 O(n) 开销。可以改为构建期预计算目录树。

2. **`wc -c` 语义不严格**：`wc.ts` 用 `text.length`（UTF-16 码元）当字节数，真正的 `wc -c` 应是 UTF-8 字节数。对中文内容会少算。这是"有意的简单"，但作为"OS developer 主页"略微不严谨。

3. **管道没有 stderr / 退出码**：所有错误都是"打印后 return"，没有 `$?`、没有 `2>&1`。这是边界，不是缺陷，但限制了更复杂的组合。

4. **依赖版本激进**：`marked@18`、`typescript@7`、`vite@8` 都是非常新的版本，暗示作者紧跟上游（或本身就是生态参与者）。复刻时用稳定版即可，不必追新。

5. **TypeScript 严格 + 大量注释**是双刃剑：代码几乎每行都有注释，可读性极佳，但也意味着维护成本——注释会过时。

---

## 7. 可借鉴清单

如果要把这套思想用在自己的项目（比如你的麦金塔风格主页），可以直接拿走的：

| 借鉴点 | 落地方式 |
|---|---|
| 内容与代码分离 | 内容只写 markdown，一个目录就是站点结构 |
| 编译器独立 | 构建脚本可单独跑，vite 插件只是壳 |
| 统一命令契约 | 定义 `Command.run(ctx, argv)`，所有功能实现同一接口 |
| 管道 = stdout→stdin | 命令不感知自己在管道的位置 |
| 文档即命令 | 导航（清屏）和读取（不清屏）分离语义 |
| 双模式终端 | `takeOver()`/`release()` 解耦 shell 与全屏应用 |
| 构建期宏 | 日期、数学等在构建期展开成纯文本 |
| 哈希路由 | 内部链接 pushState，返回键可用 |
| 无 JS 降级 | `<noscript>` + 内联正文，curl 可读 |
| grapheme 感知的编辑器 | `displayWidth` + `prevClusterStart` 处理 CJK/emoji |
| ANSI 安全换行 | tokenize 后换行，样式跨行继承 |

---

## 结语

jyy 这个项目表面上是一个"酷炫的终端主页"，但它真正值得学习的是**架构上的克制和精确**：

- 用 Unix 心智模型（文件系统、命令、管道）组织内容
- 用编译器把构建期能做的事全部做掉
- 用一个极小的命令契约（`run(ctx, argv)`）承载全部功能
- 在细节处（字符宽度、ANSI 换行、字体闪烁、无 JS 降级）做到一丝不苟

**它证明了：一个"看起来简单"的项目，背后可以有教科书级别的分层、契约和工程判断。** 这也是为什么它值得反复研读——不是为了抄它的终端效果，而是为了学它"如何把一件小事做到正确"。
