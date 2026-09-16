// app.js - Macintosh Terminal (Pure JavaScript, No Dependencies)

(function() {
  'use strict';

  // ==================== Virtual File System ====================
  const fileSystem = {
    '/': {
      type: 'dir',
      children: ['Applications', 'System', 'Users', 'bin']
    },
    '/Applications': {
      type: 'dir',
      children: ['Terminal.app', 'TextEdit.app']
    },
    '/Applications/Terminal.app': { type: 'file', content: 'Terminal Application v1.0' },
    '/Applications/TextEdit.app': { type: 'file', content: 'Text Editor' },
    '/System': {
      type: 'dir',
      children: ['Library']
    },
    '/System/Library': {
      type: 'dir',
      children: ['Fonts', 'Extensions']
    },
    '/System/Library/Fonts': { type: 'dir', children: [] },
    '/System/Library/Extensions': { type: 'dir', children: [] },
    '/Users': {
      type: 'dir',
      children: ['you']
    },
    '/Users/you': {
      type: 'dir',
      children: ['Desktop', 'Documents', 'Downloads', 'Pictures', 'readme.txt']
    },
    '/Users/you/Desktop': {
      type: 'dir',
      children: ['welcome.txt']
    },
    '/Users/you/Desktop/welcome.txt': { type: 'file', content: 'Welcome to your Desktop!' },
    '/Users/you/Documents': {
      type: 'dir',
      children: ['bio.md', 'projects.md', 'resume.md']
    },
    '/Users/you/Documents/bio.md': {
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
- GitHub: github.com/yourusername`
    },
    '/Users/you/Documents/projects.md': {
      type: 'file',
      content: `# My Projects

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

A 2D/3D graphics engine for games.`
    },
    '/Users/you/Documents/resume.md': {
      type: 'file',
      content: `# Resume

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

- GPA: 3.8/4.0`
    },
    '/Users/you/Downloads': { type: 'dir', children: [] },
    '/Users/you/Pictures': { type: 'dir', children: [] },
    '/Users/you/readme.txt': {
      type: 'file',
      content: `Welcome to Macintosh!

This is a simulated Macintosh terminal.
Type "help" to see available commands.

Think Different.`
    },
    '/bin': {
      type: 'dir',
      children: ['ls', 'cat', 'cd', 'pwd', 'clear', 'help', 'echo', 'date', 'whoami', 'tree']
    },
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
    '/help.txt': {
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
  echo <text>      Display text
  date             Show current date/time
  whoami           Show current user
  help             Show this help message
  history          Show command history
  about            About this Mac

Keyboard Shortcuts:
  Ctrl-C           Cancel current command
  Ctrl-L           Clear screen
  Tab              Autocomplete

Think Different.`
    },
    '/about.txt': {
      type: 'file',
      content: `Macintosh Terminal Homepage
==========================

This is a retro-style terminal homepage inspired by the original Macintosh (1984).

Built with vanilla JavaScript - no frameworks, no dependencies.

Inspired by:
- Original Macintosh (1984)
- Classic Mac OS
- Think Different campaign

Created with love for the Macintosh community.`
    }
  };

  // ==================== Shell State ====================
  let cwd = '/Users/you';
  const home = '/Users/you';
  const history = [];
  let historyIndex = -1;
  const username = 'you';
  const hostname = 'macintosh';

  // ==================== DOM Elements ====================
  const termHost = document.getElementById('term-host');
  const output = document.getElementById('output');
  const input = document.getElementById('input');
  const promptText = document.getElementById('prompt-text');

  // ==================== File System Functions ====================
  function resolvePath(path) {
    if (path === '~' || path.startsWith('~/')) {
      path = home + path.slice(1);
    }
    if (!path.startsWith('/')) {
      path = cwd + (cwd === '/' ? '' : '/') + path;
    }
    // Normalize
    const parts = path.split('/').filter(Boolean);
    const normalized = [];
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') { normalized.pop(); continue; }
      normalized.push(part);
    }
    return '/' + normalized.join('/');
  }

  function fileExists(path) {
    return fileSystem.hasOwnProperty(path);
  }

  function isDir(path) {
    return fileExists(path) && fileSystem[path].type === 'dir';
  }

  function readFile(path) {
    if (!fileExists(path) || fileSystem[path].type !== 'file') return null;
    return fileSystem[path].content;
  }

  function listDir(path) {
    if (!fileExists(path) || fileSystem[path].type !== 'dir') return null;
    return fileSystem[path].children || [];
  }

  // ==================== Markdown Renderer ====================
  function renderMarkdown(text) {
    const lines = text.split('\n');
    let html = '';
    let inCode = false;
    let codeBuffer = [];

    for (const line of lines) {
      if (line.startsWith('```')) {
        if (inCode) {
          html += '<div class="code">' + escapeHtml(codeBuffer.join('\n')) + '</div>';
          codeBuffer = [];
          inCode = false;
        } else {
          inCode = true;
        }
        continue;
      }
      if (inCode) {
        codeBuffer.push(line);
        continue;
      }

      // Headings
      if (line.startsWith('# ')) {
        html += '<div class="heading1">' + renderInline(line.slice(2)) + '</div>';
        html += '<div class="separator">════════════════════════════════════════</div>';
        continue;
      }
      if (line.startsWith('## ')) {
        html += '<div class="heading2">' + renderInline(line.slice(3)) + '</div>';
        html += '<div class="separator">────────────────────────────────────</div>';
        continue;
      }
      if (line.startsWith('### ')) {
        html += '<div class="bold">' + renderInline(line.slice(4)) + '</div>';
        continue;
      }

      // Horizontal rule
      if (/^[-*_]{3,}$/.test(line.trim())) {
        html += '<div class="separator">────────────────────────────────────</div>';
        continue;
      }

      // Blockquote
      if (line.startsWith('> ')) {
        html += '<div class="italic">  │ ' + renderInline(line.slice(2)) + '</div>';
        continue;
      }

      // List items
      if (/^\s*[-*+]\s/.test(line)) {
        const text = line.replace(/^\s*[-*+]\s/, '');
        const indent = line.match(/^(\s*)/)[1].length;
        const pad = '  '.repeat(Math.floor(indent / 2));
        html += '<div>' + pad + '• ' + renderInline(text) + '</div>';
        continue;
      }
      if (/^\s*\d+\.\s/.test(line)) {
        const m = line.match(/^(\s*)(\d+)\.\s(.*)/);
        if (m) {
          const pad = '  '.repeat(Math.floor(m[1].length / 2));
          html += '<div>' + pad + m[2] + '. ' + renderInline(m[3]) + '</div>';
        }
        continue;
      }

      // Empty line
      if (line.trim() === '') {
        html += '<br>';
        continue;
      }

      // Normal text
      html += '<div>' + renderInline(line) + '</div>';
    }
    return html;
  }

  function renderInline(text) {
    text = text.replace(/\*\*(.*?)\*\*/g, '<span class="bold">$1</span>');
    text = text.replace(/__(.*?)__/g, '<span class="bold">$1</span>');
    text = text.replace(/\*(.*?)\*/g, '<span class="italic">$1</span>');
    text = text.replace(/_(.*?)_/g, '<span class="italic">$1</span>');
    text = text.replace(/`([^`]+)`/g, '<span class="code">$1</span>');
    return text;
  }

  function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

  // ==================== Display Functions ====================
  function getDisplayCwd() {
    if (cwd === home) return '~';
    if (cwd.startsWith(home + '/')) return '~' + cwd.slice(home.length);
    return cwd;
  }

  function updatePrompt() {
    promptText.textContent = `Macintosh:${getDisplayCwd()} $ `;
  }

  function appendOutput(html, className) {
    const div = document.createElement('div');
    div.className = className || 'line';
    div.innerHTML = html;
    output.appendChild(div);
  }

  function appendText(text) {
    const div = document.createElement('div');
    div.className = 'line';
    div.textContent = text;
    output.appendChild(div);
  }

  function appendRaw(text) {
    const pre = document.createElement('pre');
    pre.className = 'line';
    pre.style.margin = '0';
    pre.style.fontFamily = 'inherit';
    pre.textContent = text;
    output.appendChild(pre);
  }

  function scrollToBottom() {
    termHost.scrollTop = termHost.scrollHeight;
  }

  // ==================== Commands ====================
  const commands = {
    ls: (args) => {
      const path = args[0] ? resolvePath(args[0]) : cwd;
      const items = listDir(path);
      if (!items) {
        return `ls: ${args[0] || path}: No such file or directory`;
      }
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
      if (args[0].endsWith('.md')) {
        return { markdown: content };
      }
      return content;
    },

    cd: (args) => {
      const path = args[0] || '~';
      const resolved = resolvePath(path);
      if (!isDir(resolved)) {
        return `cd: no such file or directory: ${path}`;
      }
      cwd = resolved;
      updatePrompt();
      return null;
    },

    pwd: () => cwd,

    tree: (args) => {
      const path = args[0] ? resolvePath(args[0]) : cwd;
      if (!isDir(path)) return `tree: ${path}: Not a directory`;
      return path + '\n' + generateTree(path, '');
    },

    echo: (args) => args.join(' '),

    date: () => new Date().toString(),

    whoami: () => username,

    hostname: () => hostname,

    clear: () => {
      output.innerHTML = '';
      return null;
    },

    help: () => {
      const content = readFile('/help.txt');
      return content || 'Help not available';
    },

    about: () => {
      const content = readFile('/about.txt');
      return content || 'Macintosh Terminal - Think Different.';
    },

    history: () => {
      return history.map((cmd, i) => `  ${i + 1}  ${cmd}`).join('\n');
    }
  };

  // ==================== Autocomplete ====================
  function autocomplete(partial) {
    const candidates = [];

    // Check commands
    for (const cmd of Object.keys(commands)) {
      if (cmd.startsWith(partial)) candidates.push(cmd);
    }

    // Check files in current dir
    const items = listDir(cwd);
    if (items) {
      for (const item of items) {
        if (item.startsWith(partial)) candidates.push(item);
      }
    }

    return [...new Set(candidates)];
  }

  // ==================== Command Execution ====================
  function executeCommand(line) {
    const trimmed = line.trim();
    if (!trimmed) return;

    history.push(trimmed);
    historyIndex = history.length;

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    if (commands[cmd]) {
      const result = commands[cmd](args);
      if (result === null) return; // cd, clear handle themselves
      if (typeof result === 'object' && result.markdown) {
        appendOutput(renderMarkdown(result.markdown), 'line');
      } else if (result) {
        if (result.includes('\n')) {
          appendRaw(result);
        } else {
          appendText(result);
        }
      }
    } else {
      appendText(`Macintosh: command not found: ${cmd}`);
    }
  }

  // ==================== Input Handling ====================
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const value = input.value;
      // Show the command in output
      appendText(`Macintosh:${getDisplayCwd()} $ ${value}`);
      input.value = '';
      executeCommand(value);
      scrollToBottom();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const value = input.value;
      const parts = value.split(/\s+/);
      const partial = parts[parts.length - 1];
      if (!partial) return;

      const candidates = autocomplete(partial);
      if (candidates.length === 1) {
        parts[parts.length - 1] = candidates[0];
        input.value = parts.join(' ') + (isDir(resolvePath(candidates[0])) ? '/' : ' ');
      } else if (candidates.length > 1) {
        appendText(`Macintosh:${getDisplayCwd()} $ ${value}`);
        appendText(candidates.join('  '));
        scrollToBottom();
      }
    } else if (e.key === 'c' && e.ctrlKey) {
      appendText(`Macintosh:${getDisplayCwd()} $ ${input.value}^C`);
      input.value = '';
      scrollToBottom();
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      output.innerHTML = '';
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        input.value = history[historyIndex];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        historyIndex++;
        input.value = history[historyIndex];
      } else {
        historyIndex = history.length;
        input.value = '';
      }
    }
  });

  // Focus input when clicking terminal
  termHost.addEventListener('click', () => input.focus());

  // ==================== Boot Sequence ====================
  function boot() {
    const logo = [
      '',
      '     __  ________  _____ ',
      '    / / / /_  __/ / /   |',
      '   / /_/ / / / / / / /| |',
      '  / __  / / / / / /___/ ',
      ' /_/ /_/ /_/ /_/_____/  ',
      '',
      '  Think Different.',
      '',
      'Welcome to Macintosh Terminal v1.0',
      'Type \x1b[1mhelp\x1b[0m for available commands.',
      ''
    ];

    logo.forEach(line => appendText(line));
    updatePrompt();
    scrollToBottom();
  }

  // ==================== Initialize ====================
  boot();
  input.focus();

})();
