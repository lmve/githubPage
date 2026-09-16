// app.js - Macintosh Terminal with xterm.js
// Full interactive shell experience like jyy.github.io

(function() {
  'use strict';

  // ==================== Configuration ====================
  const CONFIG = {
    username: 'you',
    hostname: 'macintosh',
    home: '/Users/you',
    shell: 'Macintosh'
  };

  // ==================== Virtual File System ====================
  const fs = {
    '/': { type: 'dir', children: ['Applications', 'System', 'Users', 'bin', 'help.txt', 'about.txt'] },
    '/Applications': { type: 'dir', children: ['Terminal.app', 'TextEdit.app'] },
    '/Applications/Terminal.app': { type: 'file', content: 'Terminal Application v1.0' },
    '/Applications/TextEdit.app': { type: 'file', content: 'Text Editor' },
    '/System': { type: 'dir', children: ['Library'] },
    '/System/Library': { type: 'dir', children: ['Fonts', 'Extensions'] },
    '/System/Library/Fonts': { type: 'dir', children: [] },
    '/System/Library/Extensions': { type: 'dir', children: [] },
    '/Users': { type: 'dir', children: ['you'] },
    '/Users/you': { type: 'dir', children: ['Desktop', 'Documents', 'Downloads', 'Pictures', 'readme.txt'] },
    '/Users/you/Desktop': { type: 'dir', children: ['welcome.txt'] },
    '/Users/you/Desktop/welcome.txt': { type: 'file', content: 'Welcome to your Desktop!' },
    '/Users/you/Documents': { type: 'dir', children: ['bio.md', 'projects.md', 'resume.md', 'wiki'] },
    '/Users/you/Documents/wiki': { type: 'dir', children: ['notes.md', 'tips.md'] },
    '/Users/you/Documents/wiki/notes.md': { type: 'file', content: '# Development Notes\n\n## Quick Tips\n\n- Use `git log --oneline` for compact history\n- `git diff --staged` before commit\n- Always write tests first' },
    '/Users/you/Documents/wiki/tips.md': { type: 'file', content: '# Terminal Tips\n\n## Shortcuts\n\n- `Ctrl-R` - Search history\n- `Ctrl-A` - Move to start\n- `Ctrl-E` - Move to end\n- `Ctrl-W` - Delete word' },
    '/Users/you/Documents/bio.md': { type: 'file', content: `# About Me

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
- GitHub: github.com/yourusername` },
    '/Users/you/Documents/projects.md': { type: 'file', content: `# My Projects

## Project 1: Terminal Emulator

A retro-style terminal emulator for the web.

**Features:**
- Full command history
- Tab completion
- Virtual file system

## Project 2: Operating System

A small hobby OS written in Rust.

**Features:**
- Memory management
- Process scheduling
- File system

## Project 3: Graphics Engine

A 2D/3D graphics engine for games.` },
    '/Users/you/Documents/resume.md': { type: 'file', content: `# Resume

## Experience

### Software Engineer
**Company Name** | 2020 - Present

- Developed web applications using React and Node.js
- Implemented real-time features using WebSockets

### Junior Developer
**Another Company** | 2018 - 2020

- Built RESTful APIs
- Wrote unit and integration tests

## Education

### Bachelor of Science in Computer Science
**University Name** | 2014 - 2018

- GPA: 3.8/4.0` },
    '/Users/you/Downloads': { type: 'dir', children: [] },
    '/Users/you/Pictures': { type: 'dir', children: [] },
    '/Users/you/readme.txt': { type: 'file', content: 'Welcome to Macintosh!\nType "help" to see available commands.\n\nThink Different.' },
    '/bin': { type: 'dir', children: ['ls', 'cat', 'cd', 'pwd', 'clear', 'help', 'echo', 'date', 'whoami', 'tree', 'head', 'tail', 'grep', 'find', 'wc', 'more', 'less'] },
    '/bin/ls': { type: 'file', content: 'list directory contents' },
    '/bin/cat': { type: 'file', content: 'concatenate and display files' },
    '/bin/cd': { type: 'file', content: 'change directory' },
    '/bin/pwd': { type: 'file', content: 'print working directory' },
    '/bin/clear': { type: 'file', content: 'clear the screen' },
    '/bin/help': { type: 'file', content: 'display help information' },
    '/bin/echo': { type: 'file', content: 'display a line of text' },
    '/bin/date': { type: 'file', content: 'display the current date and time' },
    '/bin/whoami': { type: 'file', content: 'print current user name' },
    '/bin/tree': { type: 'file', content: 'display directory tree' },
    '/bin/head': { type: 'file', content: 'output the first lines of a file' },
    '/bin/tail': { type: 'file', content: 'output the last lines of a file' },
    '/bin/grep': { type: 'file', content: 'search for patterns' },
    '/bin/find': { type: 'file', content: 'find files' },
    '/bin/wc': { type: 'file', content: 'word count' },
    '/bin/more': { type: 'file', content: 'pager' },
    '/bin/less': { type: 'file', content: 'pager' },
    '/help.txt': { type: 'file', content: `Macintosh Terminal v1.0
======================

Available Commands:

  ls [path]        List directory contents
  cat <file>       Display file contents
  cd <path>        Change directory
  pwd              Print working directory
  tree [path]      Display directory tree
  head [-n N]      Show first N lines (default 10)
  tail [-n N]      Show last N lines (default 10)
  grep <pattern>   Search for pattern in files
  find [path]      Find files
  wc               Word count
  more <file>      View file (space/q)
  less <file>      View file (arrows/q)
  echo <text>      Display text
  date             Show current date/time
  whoami           Show current user
  help             Show this help message
  history          Show command history
  about            About this Mac

Navigation:
  cd ~             Go to home directory
  cd ..            Go to parent directory
  cd /             Go to root directory

Pipes:
  cmd1 | cmd2      Pipe output to next command
  Example: cat bio.md | grep JavaScript

Keyboard Shortcuts:
  Ctrl-C           Cancel current command
  Ctrl-L           Clear screen
  Ctrl-A           Move to start of line
  Ctrl-E           Move to end of line
  Ctrl-U           Clear line
  Ctrl-K           Kill to end of line
  Ctrl-W           Delete word backward
  Tab              Autocomplete

Think Different.` },
    '/about.txt': { type: 'file', content: `Macintosh Terminal Homepage
==========================

This is a retro-style terminal homepage inspired by the original Macintosh (1984) and jyy.github.io.

Features:
- Full xterm.js terminal emulation
- Virtual file system with directories
- Command history and autocomplete
- Markdown rendering
- Pipe support (cmd1 | cmd2)
- Pager (more/less) for long content
- CRT visual effects

Built with:
- xterm.js (terminal emulator)
- Vanilla JavaScript
- Pure CSS

Think Different.` }
  };

  // ==================== Shell State ====================
  let cwd = CONFIG.home;
  const history = [];
  let historyIndex = -1;
  let buffer = '';
  let cursorPos = 0;

  // ==================== Terminal Setup ====================
  const term = new Terminal({
    fontFamily: "'Chicago', 'Geneva', 'Monaco', 'Courier New', monospace",
    fontSize: 14,
    lineHeight: 1.3,
    letterSpacing: 0,
    cursorBlink: true,
    cursorStyle: 'block',
    cursorInactiveStyle: 'outline',
    scrollback: 10000,
    allowProposedApi: true,
    theme: {
      background: '#ffffff',
      foreground: '#000000',
      cursor: '#000000',
      cursorAccent: '#ffffff',
      selectionBackground: '#000000',
      selectionForeground: '#ffffff',
      black: '#000000',
      red: '#000000',
      green: '#555555',
      yellow: '#888888',
      blue: '#000000',
      magenta: '#000000',
      cyan: '#555555',
      white: '#ffffff',
      brightBlack: '#888888',
      brightRed: '#888888',
      brightGreen: '#aaaaaa',
      brightYellow: '#aaaaaa',
      brightBlue: '#888888',
      brightMagenta: '#888888',
      brightCyan: '#aaaaaa',
      brightWhite: '#ffffff'
    }
  });

  // Load addons
  const fitAddon = new FitAddon.FitAddon();
  const unicodeAddon = new Unicode11Addon.Unicode11Addon();
  term.loadAddon(fitAddon);
  term.loadAddon(unicodeAddon);
  term.unicode.activeVersion = '11';

  // Mount terminal
  term.open(document.getElementById('term-screen'));
  fitAddon.fit();

  // Auto-resize
  const resizeObserver = new ResizeObserver(() => fitAddon.fit());
  resizeObserver.observe(document.getElementById('term-host'));

  // ==================== File System Functions ====================
  function resolvePath(path) {
    if (path === '~' || path.startsWith('~/')) {
      path = CONFIG.home + path.slice(1);
    }
    if (!path.startsWith('/')) {
      path = cwd + (cwd === '/' ? '' : '/') + path;
    }
    const parts = path.split('/').filter(Boolean);
    const normalized = [];
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') { normalized.pop(); continue; }
      normalized.push(part);
    }
    return '/' + normalized.join('/');
  }

  function fileExists(path) { return fs.hasOwnProperty(path); }
  function isDir(path) { return fileExists(path) && fs[path].type === 'dir'; }
  function isFile(path) { return fileExists(path) && fs[path].type === 'file'; }
  function readFile(path) { return isFile(path) ? fs[path].content : null; }
  function listDir(path) { return isDir(path) ? (fs[path].children || []) : null; }

  function getDisplayCwd() {
    if (cwd === CONFIG.home) return '~';
    if (cwd.startsWith(CONFIG.home + '/')) return '~' + cwd.slice(CONFIG.home.length);
    return cwd;
  }

  // ==================== Markdown Renderer ====================
  function renderMarkdown(text) {
    try {
      if (typeof marked !== 'undefined') {
        marked.setOptions({ breaks: true, gfm: true });
        // Convert HTML to ANSI-like terminal output
        let html = marked.parse(text);
        return htmlToAnsi(html);
      }
    } catch(e) {}
    return text;
  }

  function htmlToAnsi(html) {
    let result = html;
    // Headers
    result = result.replace(/<h1[^>]*>(.*?)<\/h1>/gs, '\x1b[1m\x1b[4m $1 \x1b[0m\n' + '═'.repeat(40));
    result = result.replace(/<h2[^>]*>(.*?)<\/h2>/gs, '\x1b[1m $1 \x1b[0m\n' + '─'.repeat(30));
    result = result.replace(/<h3[^>]*>(.*?)<\/h3>/gs, '\x1b[1m$1\x1b[0m');
    // Bold
    result = result.replace(/<strong>(.*?)<\/strong>/gs, '\x1b[1m$1\x1b[0m');
    result = result.replace(/<b>(.*?)<\/b>/gs, '\x1b[1m$1\x1b[0m');
    // Italic
    result = result.replace(/<em>(.*?)<\/em>/gs, '\x1b[3m$1\x1b[0m');
    result = result.replace(/<i>(.*?)<\/i>/gs, '\x1b[3m$1\x1b[0m');
    // Code
    result = result.replace(/<code>(.*?)<\/code>/gs, '\x1b[7m$1\x1b[0m');
    // Lists
    result = result.replace(/<li>(.*?)<\/li>/gs, '  • $1');
    result = result.replace(/<br\s*\/?>/gs, '\n');
    // Paragraphs
    result = result.replace(/<p>(.*?)<\/p>/gs, '$1\n');
    result = result.replace(/<\/?[^>]+(>|$)/g, '');
    result = result.replace(/&amp;/g, '&');
    result = result.replace(/&lt;/g, '<');
    result = result.replace(/&gt;/g, '>');
    result = result.replace(/&nbsp;/g, ' ');
    return result.trim();
  }

  // ==================== Tree Generator ====================
  function generateTree(path, prefix) {
    const items = listDir(path);
    if (!items) return '';
    let result = '';
    items.forEach((item, i) => {
      const isLast = i === items.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const fullPath = path === '/' ? '/' + item : path + '/' + item;
      const isItemDir = isDir(fullPath);
      result += prefix + connector + item + (isItemDir ? '/' : '') + '\n';
      if (isItemDir) {
        result += generateTree(fullPath, prefix + (isLast ? '    ' : '│   '));
      }
    });
    return result;
  }

  // ==================== Commands ====================
  const commands = {
    ls: (args) => {
      const path = args[0] ? resolvePath(args[0]) : cwd;
      const items = listDir(path);
      if (!items) return `ls: ${args[0] || path}: No such file or directory`;
      if (items.length === 0) return null;
      return items.map(item => {
        const fp = path === '/' ? '/' + item : path + '/' + item;
        return item + (isDir(fp) ? '/' : '');
      }).join('  ');
    },

    cat: (args) => {
      if (args.length === 0) return 'Usage: cat <file>';
      const path = resolvePath(args[0]);
      const content = readFile(path);
      if (content === null) return `cat: ${args[0]}: No such file or directory`;
      if (args[0].endsWith('.md')) return { markdown: content };
      return content;
    },

    cd: (args) => {
      const path = args[0] || '~';
      const resolved = resolvePath(path);
      if (!isDir(resolved)) return `cd: no such file or directory: ${path}`;
      cwd = resolved;
      return null;
    },

    pwd: () => cwd,

    tree: (args) => {
      const path = args[0] ? resolvePath(args[0]) : cwd;
      if (!isDir(path)) return `tree: ${path}: Not a directory`;
      return path + '\n' + generateTree(path, '');
    },

    head: (args) => {
      let n = 10;
      let file = null;
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-n' && args[i+1]) { n = parseInt(args[i+1]) || 10; i++; }
        else file = args[i];
      }
      if (!file) return 'Usage: head [-n N] <file>';
      const content = readFile(resolvePath(file));
      if (content === null) return `head: ${file}: No such file`;
      return content.split('\n').slice(0, n).join('\n');
    },

    tail: (args) => {
      let n = 10;
      let file = null;
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-n' && args[i+1]) { n = parseInt(args[i+1]) || 10; i++; }
        else file = args[i];
      }
      if (!file) return 'Usage: tail [-n N] <file>';
      const content = readFile(resolvePath(file));
      if (content === null) return `tail: ${file}: No such file`;
      const lines = content.split('\n');
      return lines.slice(-n).join('\n');
    },

    grep: (args) => {
      if (args.length < 1) return 'Usage: grep <pattern> [file]';
      const pattern = args[0];
      const file = args[1];
      if (!file) {
        // Search all files in current directory
        const items = listDir(cwd);
        let results = '';
        items.forEach(item => {
          const fp = cwd === '/' ? '/' + item : cwd + '/' + item;
          const content = readFile(fp);
          if (content) {
            const matches = content.split('\n').filter(l => l.includes(pattern));
            if (matches.length > 0) {
              results += item + ':\n' + matches.map(m => '  ' + m).join('\n') + '\n';
            }
          }
        });
        return results || `grep: no matches for "${pattern}"`;
      }
      const content = readFile(resolvePath(file));
      if (!content) return `grep: ${file}: No such file`;
      const matches = content.split('\n').filter(l => l.includes(pattern));
      return matches.length > 0 ? matches.join('\n') : null;
    },

    find: (args) => {
      const searchPath = args[0] ? resolvePath(args[0]) : cwd;
      const results = [];
      function walk(path) {
        if (isFile(path)) results.push(path);
        const items = listDir(path);
        if (items) items.forEach(item => {
          const fp = path === '/' ? '/' + item : path + '/' + item;
          walk(fp);
        });
      }
      walk(searchPath);
      return results.join('\n');
    },

    wc: (args) => {
      const file = args[0];
      if (!file) return 'Usage: wc <file>';
      const content = readFile(resolvePath(file));
      if (!content) return `wc: ${file}: No such file`;
      const lines = content.split('\n').length;
      const words = content.split(/\s+/).filter(Boolean).length;
      const chars = content.length;
      return `  ${lines}  ${words}  ${chars} ${file}`;
    },

    more: (args) => {
      const file = args[0];
      if (!file) return 'Usage: more <file>';
      const content = readFile(resolvePath(file));
      if (!content) return `more: ${file}: No such file`;
      return { pager: content, mode: 'more' };
    },

    less: (args) => {
      const file = args[0];
      if (!file) return 'Usage: less <file>';
      const content = readFile(resolvePath(file));
      if (!content) return `less: ${file}: No such file`;
      return { pager: content, mode: 'less' };
    },

    echo: (args) => args.join(' '),

    date: () => new Date().toString(),

    whoami: () => CONFIG.username,

    hostname: () => CONFIG.hostname,

    clear: () => { term.write('\x1b[2J\x1b[3J\x1b[H'); return null; },

    help: () => readFile('/help.txt'),

    about: () => readFile('/about.txt'),

    history: () => history.map((cmd, i) => `  ${i + 1}  ${cmd}`).join('\n'),
  };

  // ==================== Autocomplete ====================
  function autocomplete(partial) {
    const candidates = [];
    for (const cmd of Object.keys(commands)) {
      if (cmd.startsWith(partial)) candidates.push(cmd);
    }
    const items = listDir(cwd);
    if (items) {
      for (const item of items) {
        if (item.startsWith(partial)) candidates.push(item);
      }
    }
    return [...new Set(candidates)];
  }

  // ==================== Prompt ====================
  function getPrompt() {
    return `\x1b[1m${CONFIG.username}@${CONFIG.hostname}\x1b[0m:\x1b[1m${getDisplayCwd()}\x1b[0m$ `;
  }

  // ==================== Pager (more/less) ====================
  let pagerState = null;

  function enterPager(content, mode) {
    const lines = content.split('\n');
    const pageSize = Math.max(10, term.rows - 3);
    pagerState = {
      lines,
      mode,
      pageStart: 0,
      pageSize,
      totalPages: Math.ceil(lines.length / pageSize)
    };
    renderPagerPage();
  }

  function renderPagerPage() {
    if (!pagerState) return;
    const { lines, pageStart, pageSize, mode, totalPages } = pagerState;
    const pageEnd = Math.min(pageStart + pageSize, lines.length);
    const page = lines.slice(pageStart, pageEnd).join('\n');
    const percent = Math.round((pageEnd / lines.length) * 100);
    const status = mode === 'more' ? '--More--' : `--Less-- (${percent}%)`;

    term.write('\x1b[2J\x1b[3J\x1b[H');
    term.write(page);
    term.write(`\x1b[7m${status}\x1b[0m`);
  }

  function handlePagerInput(data) {
    if (!pagerState) return false;
    const { lines, pageSize, mode } = pagerState;
    const maxStart = Math.max(0, lines.length - pageSize);

    switch(data) {
      case 'q':
      case '\x1b':
        pagerState = null;
        term.write('\x1b[2J\x1b[3J\x1b[H');
        term.write(getPrompt() + buffer);
        return true;
      case ' ':
      case 'f':
      case '\x1b[6~': // PageDown
        pagerState.pageStart = Math.min(pagerState.pageStart + pageSize, maxStart);
        renderPagerPage();
        return true;
      case 'b':
      case '\x1b[5~': // PageUp
        pagerState.pageStart = Math.max(0, pagerState.pageStart - pageSize);
        renderPagerPage();
        return true;
      case '\x1b[B': // Down
      case 'j':
      case '\r':
        if (pagerState.pageStart < maxStart) {
          pagerState.pageStart++;
          renderPagerPage();
        }
        return true;
      case '\x1b[A': // Up
      case 'k':
        if (pagerState.pageStart > 0) {
          pagerState.pageStart--;
          renderPagerPage();
        }
        return true;
      case 'g':
        pagerState.pageStart = 0;
        renderPagerPage();
        return true;
      case 'G':
        pagerState.pageStart = maxStart;
        renderPagerPage();
        return true;
      case '\x04': // Ctrl-D
        pagerState.pageStart = Math.min(pagerState.pageStart + Math.floor(pageSize/2), maxStart);
        renderPagerPage();
        return true;
      case '\x15': // Ctrl-U
        pagerState.pageStart = Math.max(0, pagerState.pageStart - Math.floor(pageSize/2));
        renderPagerPage();
        return true;
    }
    return true;
  }

  // ==================== Command Execution ====================
  function executeCommand(line) {
    const trimmed = line.trim();
    if (!trimmed) return;

    history.push(trimmed);
    historyIndex = history.length;

    // Handle pipes
    const pipeline = trimmed.split('|').map(s => s.trim());
    let lastOutput = null;

    for (let i = 0; i < pipeline.length; i++) {
      const parts = pipeline[i].split(/\s+/);
      const cmd = parts[0];
      const args = parts.slice(1);

      if (commands[cmd]) {
        try {
          lastOutput = commands[cmd](args);
        } catch(e) {
          term.write(`Error: ${e.message}\r\n`);
          return;
        }

        if (lastOutput === null) continue;

        if (typeof lastOutput === 'object') {
          if (lastOutput.pager) {
            enterPager(lastOutput.pager, lastOutput.mode);
            return;
          }
          if (lastOutput.markdown) {
            lastOutput = renderMarkdown(lastOutput.markdown);
          }
        }

        // If not last command, pass to next as string
        if (i < pipeline.length - 1) {
          // Continue to next command (lastOutput becomes input)
        }
      } else {
        term.write(`Macintosh: command not found: ${cmd}\r\n`);
        return;
      }
    }

    if (lastOutput !== null && lastOutput !== undefined) {
      const lines = String(lastOutput).split('\n');
      lines.forEach(line => term.write(line + '\r\n'));
    }
  }

  // ==================== Input Handling ====================
  function showPrompt() {
    term.write(getPrompt());
    buffer = '';
    cursorPos = 0;
  }

  term.onData(data => {
    // Handle pager mode
    if (pagerState) {
      handlePagerInput(data);
      return;
    }

    // Ctrl key combinations
    if (data.charCodeAt(0) < 32 && data.length === 1) {
      const code = data.charCodeAt(0);
      switch(code) {
        case 3: // Ctrl-C
          term.write('^C\r\n');
          showPrompt();
          return;
        case 4: // Ctrl-D
          if (buffer.length === 0) {
            term.write('\r\nGoodbye!\r\n');
            term.write('\x1b[?25l'); // Hide cursor
          }
          return;
        case 7: // Ctrl-G
          term.write('\x07');
          return;
        case 8: // Ctrl-H (Backspace)
          if (cursorPos > 0) {
            buffer = buffer.slice(0, cursorPos - 1) + buffer.slice(cursorPos);
            cursorPos--;
            redrawInput();
          }
          return;
        case 11: // Ctrl-K
          buffer = buffer.slice(0, cursorPos);
          term.write('\x1b[K');
          return;
        case 12: // Ctrl-L
          term.write('\x1b[2J\x1b[3J\x1b[H');
          showPrompt();
          return;
        case 21: // Ctrl-U
          buffer = buffer.slice(cursorPos);
          cursorPos = 0;
          redrawInput();
          return;
        case 23: // Ctrl-W
          const before = buffer.slice(0, cursorPos);
          const after = buffer.slice(cursorPos);
          const newBefore = before.replace(/\S+\s*$/, '');
          buffer = newBefore + after;
          cursorPos = newBefore.length;
          redrawInput();
          return;
      }
    }

    // Special keys
    if (data.startsWith('\x1b')) {
      switch(data) {
        case '\x1b[A': // Up
          if (history.length > 0 && historyIndex > 0) {
            historyIndex--;
            buffer = history[historyIndex];
            cursorPos = buffer.length;
            redrawInput();
          }
          return;
        case '\x1b[B': // Down
          if (historyIndex < history.length - 1) {
            historyIndex++;
            buffer = history[historyIndex];
            cursorPos = buffer.length;
            redrawInput();
          } else {
            historyIndex = history.length;
            buffer = '';
            cursorPos = 0;
            redrawInput();
          }
          return;
        case '\x1b[D': // Left
          if (cursorPos > 0) {
            cursorPos--;
            term.write('\x1b[D');
          }
          return;
        case '\x1b[C': // Right
          if (cursorPos < buffer.length) {
            cursorPos++;
            term.write('\x1b[C');
          }
          return;
        case '\x1b[H': // Home
          while (cursorPos > 0) { cursorPos--; term.write('\x1b[D'); }
          return;
        case '\x1b[F': // End
          while (cursorPos < buffer.length) { cursorPos++; term.write('\x1b[C'); }
          return;
        case '\x1b[3~': // Delete
          if (cursorPos < buffer.length) {
            buffer = buffer.slice(0, cursorPos) + buffer.slice(cursorPos + 1);
            redrawInput();
          }
          return;
      }
      return;
    }

    // Tab
    if (data === '\t') {
      const beforeCursor = buffer.slice(0, cursorPos);
      const parts = beforeCursor.split(/\s+/);
      const partial = parts[parts.length - 1];
      if (partial) {
        const candidates = autocomplete(partial);
        if (candidates.length === 1) {
          parts[parts.length - 1] = candidates[0];
          const suffix = isDir(resolvePath(candidates[0])) ? '/' : ' ';
          buffer = parts.join(' ') + suffix + buffer.slice(cursorPos);
          cursorPos = parts.join(' ').length + suffix.length;
          redrawInput();
        } else if (candidates.length > 1) {
          term.write('\r\n' + candidates.join('  ') + '\r\n');
          term.write(getPrompt() + buffer);
          // Reset cursor
          const promptLen = getPrompt().length;
          for (let i = buffer.length; i > cursorPos; i--) term.write('\x1b[D');
        }
      }
      return;
    }

    // Enter
    if (data === '\r') {
      term.write('\r\n');
      executeCommand(buffer);
      if (!pagerState) showPrompt();
      return;
    }

    // Regular character
    if (data >= ' ' && data.length === 1) {
      buffer = buffer.slice(0, cursorPos) + data + buffer.slice(cursorPos);
      cursorPos++;
      // Write the character and restore cursor if needed
      if (cursorPos < buffer.length) {
        term.write(data + buffer.slice(cursorPos));
        // Move cursor back
        for (let i = buffer.length; i > cursorPos; i--) term.write('\x1b[D');
      } else {
        term.write(data);
      }
    }
  });

  function redrawInput() {
    term.write('\x1b[2K');
    term.write('\r' + getPrompt() + buffer);
    // Position cursor
    const promptLen = getPrompt().length;
    const targetCol = promptLen + cursorPos;
    term.write(`\x1b[${targetCol}G`);
  }

  // ==================== Boot Sequence ====================
  function boot() {
    const logo = [
      '',
      '\x1b[1m     __  ________  _____ \x1b[0m',
      '\x1b[1m    / / / /_  __/ / /   |\x1b[0m',
      '\x1b[1m   / /_/ / / / / / / /| |\x1b[0m',
      '\x1b[1m  / __  / / / / / /___/ \x1b[0m',
      '\x1b[1m /_/ /_/ /_/ /_/_____/  \x1b[0m',
      '',
      '\x1b[3m  Think Different.\x1b[0m',
      '',
      'Welcome to Macintosh Terminal v1.0',
      'Type \x1b[1mhelp\x1b[0m for available commands.',
      'Try: \x1b[1mbio\x1b[0m, \x1b[1mtree ~/Documents\x1b[0m, \x1b[1mcat bio.md | grep JavaScript\x1b[0m',
      ''
    ];

    logo.forEach(line => term.write(line + '\r\n'));
    showPrompt();
  }

  // ==================== Focus Handling ====================
  document.getElementById('term-host').addEventListener('click', () => term.focus());
  term.focus();

  // ==================== Start ====================
  boot();

})();
