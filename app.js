// ==========================================================================
// app.js — Macintosh-style terminal homepage.
// A faithful port of jiangyy.github.io's architecture, in dependency-free JS
// (xterm.js + marked loaded from CDN). Four concerns, decoupled:
//
//   content.js ——> DOCS (markdown) ——> doc commands + virtual FS
//   term       : xterm.js wrapper (shell mode + tui mode for the pager)
//   render     : markdown tokens -> ANSI (clickable OSC 8 links)
//   shell      : REPL (line editor, history, tab-complete, pipes)
//   apps       : oneshot + TUI commands (ls/cat/.../more/less)
// ==========================================================================
(function () {
  'use strict';

  const SITE = window.SITE;
  const DOCS = window.DOCS;

  // ========================================================================
  // ANSI primitives (ported from term/ansi.ts)
  // ========================================================================
  const RESET = '\x1b[0m';
  const BOLD = '\x1b[1m';
  const DIM = '\x1b[2m';
  const ITALIC = '\x1b[3m';
  const UNDERLINE = '\x1b[4m';
  const INVERSE = '\x1b[7m';
  const fg256 = (n) => `\x1b[38;5;${n}m`;
  const move = (x, y) => `\x1b[${y + 1};${x + 1}H`;
  const ERASE_BELOW = '\x1b[0J';

  // Monochrome Macintosh palette (grayscale 256-color).
  const C = {
    heading: fg256(234), // near-black
    bullet: fg256(240),
    border: fg256(240),
    hr: fg256(250),
  };

  function link(url, text) {
    return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;
  }

  function stripAnsi(s) {
    return s.replace(/\x1b\[[0-9;]*m/g, '').replace(/\x1b\]8;;[^\x1b\\]*(?:\x1b\\|\x07)/g, '');
  }

  function isExtender(code) {
    return (
      code === 0x200d || code === 0x200c ||
      (code >= 0xfe00 && code <= 0xfe0f) ||
      (code >= 0x1f3fb && code <= 0x1f3ff) ||
      (code >= 0x0300 && code <= 0x036f) ||
      (code >= 0x1ab0 && code <= 0x1aff) ||
      (code >= 0x1dc0 && code <= 0x1dff) ||
      (code >= 0x20d0 && code <= 0x20ff) ||
      (code >= 0xfe20 && code <= 0xfe2f)
    );
  }
  function isRegional(code) {
    return code >= 0x1f1e6 && code <= 0x1f1ff;
  }
  function charWidth(code) {
    if (isExtender(code)) return 0;
    if (code < 0x300) return 1;
    if (
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0x303e) ||
      (code >= 0x3040 && code <= 0x33bf) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x4e00 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x1f000 && code <= 0x1faff)
    )
      return 2;
    return 1;
  }
  function displayWidth(str) {
    const cps = [];
    for (const ch of str) cps.push(ch.codePointAt(0) ?? 0);
    let w = 0, joinNext = false;
    for (let i = 0; i < cps.length; i++) {
      const cp = cps[i];
      if (cp === 0x200d) { joinNext = true; continue; }
      if (isExtender(cp)) continue;
      if (joinNext) { joinNext = false; continue; }
      if (isRegional(cp) && i + 1 < cps.length && isRegional(cps[i + 1])) { w += 2; i++; continue; }
      w += charWidth(cp);
    }
    return w;
  }
  function prevClusterStart(str, at) {
    if (at <= 0) return 0;
    const cps = [...str.slice(0, at)];
    const cp = (i) => cps[i].codePointAt(0) ?? 0;
    let k = cps.length;
    while (k > 0 && isExtender(cp(k - 1))) k--;
    if (k === 0) return at;
    k--;
    while (k >= 2 && cp(k - 1) === 0x200d) k -= 2;
    if (k >= 2 && isRegional(cp(k - 1)) && isRegional(cp(k - 2))) k--;
    return cps.slice(0, k).reduce((n, s) => n + s.length, 0);
  }
  function nextClusterEnd(str, at) {
    const cps = [...str.slice(at)];
    if (cps.length === 0) return at;
    const cp = (i) => cps[i].codePointAt(0) ?? 0;
    let k = 1;
    const eat = () => { while (k < cps.length && isExtender(cp(k)) && cp(k) !== 0x200d) k++; };
    eat();
    while (k + 1 < cps.length && cp(k) === 0x200d) { k += 2; eat(); }
    return at + cps.slice(0, k).reduce((n, s) => n + s.length, 0);
  }

  // ========================================================================
  // Styled-line wrapping (ported from term/wrap.ts)
  // ========================================================================
  function tokenize(line) {
    const toks = [];
    let i = 0;
    while (i < line.length) {
      const c = line.charCodeAt(i);
      if (c === 0x1b) {
        const next = line.charCodeAt(i + 1);
        if (next === 0x5b) {
          let j = i + 2;
          while (j < line.length && /[0-9;]/.test(line[j])) j++;
          toks.push({ kind: 'sgr', seq: line.slice(i, j + 1) });
          i = j + 1;
          continue;
        }
        if (next === 0x5d) {
          let j = i + 2;
          while (j < line.length && line.charCodeAt(j) !== 0x07 &&
            !(line.charCodeAt(j) === 0x1b && line.charCodeAt(j + 1) === 0x5c)) j++;
          if (line.charCodeAt(j) === 0x07) { toks.push({ kind: 'osc', seq: line.slice(i, j + 1) }); i = j + 1; }
          else { toks.push({ kind: 'osc', seq: line.slice(i, j + 2) }); i = j + 2; }
          continue;
        }
        toks.push({ kind: 'osc', seq: line.slice(i, i + 2) });
        i += 2;
        continue;
      }
      if (c >= 0xd800 && c <= 0xdbff) {
        toks.push({ kind: 'ch', s: line.slice(i, i + 2), w: charWidth(line.codePointAt(i) ?? 0) });
        i += 2;
        continue;
      }
      toks.push({ kind: 'ch', s: line[i], w: charWidth(c) });
      i += 1;
    }
    return toks;
  }

  const tokStr = (ts) => ts.map((t) => (t.kind === 'ch' ? t.s : t.seq)).join('');

  function foldSgr(open, toks) {
    let o = open;
    for (const t of toks) {
      if (t.kind !== 'sgr') continue;
      o = t.seq === RESET || t.seq === '\x1b[m' ? '' : o + t.seq;
    }
    return o;
  }

  function wrapLine(line, cols) {
    const toks = tokenize(line);
    const out = [];
    let cur = '', w = 0, open = '';
    const breakLine = () => { out.push(cur + (open ? RESET : '')); cur = open; w = 0; };
    for (const t of toks) {
      if (t.kind !== 'ch') {
        cur += t.seq;
        if (t.kind === 'sgr') open = t.seq === RESET || t.seq === '\x1b[m' ? '' : open + t.seq;
        continue;
      }
      if (w > 0 && w + t.w > cols) breakLine();
      cur += t.s;
      w += t.w;
    }
    out.push(cur + (open ? RESET : ''));
    return out;
  }

  function wrapWords(line, width) {
    if (width < 1) width = 1;
    const out = [];
    for (const seg of line.split('\n')) {
      const wrapped = wrapSegment(seg, width);
      if (wrapped.length) out.push(...wrapped);
      else out.push('');
    }
    return out;
  }
  function wrapSegment(line, width) {
    const toks = tokenize(line);
    const words = [];
    let cur = [], curW = 0;
    const flushWord = () => { if (cur.length) { words.push({ toks: cur, w: curW }); cur = []; curW = 0; } };
    for (const t of toks) {
      if (t.kind === 'ch' && t.s === ' ') { flushWord(); continue; }
      if (t.kind === 'ch') curW += t.w;
      cur.push(t);
    }
    flushWord();

    const out = [];
    let lineStr = '', w = 0, open = '';
    const flush = () => { out.push(lineStr + (open ? RESET : '')); lineStr = ''; w = 0; };
    for (const word of words) {
      if (word.w === 0) { open = foldSgr(open, word.toks); continue; }
      if (w === 0) lineStr = open;
      const needSpace = w > 0 ? 1 : 0;
      if (w + needSpace + word.w > width && w > 0) { flush(); lineStr = open; }
      if (w > 0) { lineStr += ' '; w += 1; }
      if (word.w <= width) {
        lineStr += tokStr(word.toks);
        w += word.w;
        open = foldSgr(open, word.toks);
      } else {
        for (const t of word.toks) {
          if (t.kind !== 'ch') {
            lineStr += t.seq;
            if (t.kind === 'sgr') open = t.seq === RESET || t.seq === '\x1b[m' ? '' : open + t.seq;
            continue;
          }
          if (w > 0 && w + t.w > width) { flush(); lineStr = open; }
          lineStr += t.s;
          w += t.w;
        }
      }
    }
    if (w > 0) flush();
    return out;
  }

  // ========================================================================
  // Markdown -> ANSI renderer (ported from content/render.ts)
  // ========================================================================
  function renderMarkdown(body, width) {
    let tokens;
    try { tokens = marked.lexer(body); }
    catch (e) { return body + '\n\n'; }
    const out = tokens.map((t) => renderBlock(t, width)).join('');
    return out.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n\n';
  }

  function renderInline(tokens) {
    if (!tokens) return '';
    return tokens.map(renderInlineToken).join('');
  }
  function renderInlineToken(t) {
    switch (t.type) {
      case 'strong': return BOLD + renderInline(t.tokens) + RESET;
      case 'em': return ITALIC + renderInline(t.tokens) + RESET;
      case 'codespan': return `\x1b[58;5;250m\x1b[4m${t.text}${RESET}`;
      case 'link': {
        const isEmail = t.href.startsWith('mailto:') ||
          (!/^[a-z][a-z0-9+.-]*:/i.test(t.href) && t.href.includes('@'));
        if (isEmail) return renderInline(t.tokens) || t.href;
        let href = t.href;
        if (href.startsWith('#') && typeof location !== 'undefined') {
          href = location.origin + location.pathname + href;
        }
        return link(href, renderInline(t.tokens) || t.href);
      }
      case 'image': return `${DIM}[img: ${t.text || t.href}]${RESET}`;
      case 'br': return '\n';
      case 'escape': return t.text;
      case 'text':
      default: return t.tokens ? renderInline(t.tokens) : (t.text ?? '');
    }
  }
  function renderBlock(t, width) {
    switch (t.type) {
      case 'heading': {
        const prefix = '#'.repeat(t.depth) + ' ';
        const inline = renderInline(t.tokens);
        if (t.depth === 1) {
          const w = displayWidth(prefix + stripAnsi(inline));
          return `${BOLD}${C.heading}${prefix}${inline}${RESET}\n${C.border}${'\u2500'.repeat(Math.max(2, w))}${RESET}\n\n`;
        }
        return `\n${BOLD}${C.heading}${prefix}${inline}${RESET}\n\n`;
      }
      case 'paragraph': {
        const inline = renderInline(t.tokens);
        const body = width ? wrapWords(inline, width).join('\n') : inline;
        return `${body}\n\n`;
      }
      case 'list': {
        const lines = [];
        t.items.forEach((item, i) => {
          const bullet = t.ordered ? `${i + 1}. ` : `${C.bullet}\u2022${RESET} `;
          const inner = renderInline(item.tokens).trim();
          if (!width) { lines.push(`  ${bullet}${inner}`); return; }
          const bulletW = 2 + displayWidth(stripAnsi(bullet));
          const wrapped = wrapWords(inner, Math.max(1, width - bulletW));
          const pad = ' '.repeat(bulletW);
          lines.push(`  ${bullet}${wrapped[0]}`);
          for (let k = 1; k < wrapped.length; k++) lines.push(pad + wrapped[k]);
        });
        return lines.join('\n') + '\n\n';
      }
      case 'code': {
        const body = t.text.replace(/\n$/, '');
        return `${body}\n\n`;
      }
      case 'blockquote': {
        const innerWidth = width ? Math.max(1, width - 2) : 0;
        const inner = (t.tokens ?? []).map((tk) => renderBlock(tk, innerWidth)).join('').trimEnd();
        return inner.split('\n').map((l) => `${C.border}\u2502${RESET} ${l}`).join('\n') + '\n\n';
      }
      case 'hr': return `${C.hr}${'\u2500'.repeat(40)}${RESET}\n\n`;
      case 'table': {
        const header = t.header.map((c) => renderInline(c.tokens)).join(' | ');
        const rows = t.rows.map((r) => r.map((c) => renderInline(c.tokens)).join(' | '));
        return [header, ...rows].map((r) => `  ${r}`).join('\n') + '\n\n';
      }
      case 'space':
      case 'html': return '';
      default: return renderInline([t]);
    }
  }

  // ========================================================================
  // Virtual filesystem: documents (slugs) at /, commands in /bin.
  // ========================================================================
  const docSlugs = Object.keys(DOCS);

  function isDoc(slug) {
    return DOCS.hasOwnProperty(slug);
  }
  function isDir(slug) {
    if (slug === '' || slug === 'bin') return true;
    const prefix = slug + '/';
    return docSlugs.some((d) => d.startsWith(prefix));
  }
  function isFile(slug) {
    if (slug === '' || slug === 'bin') return false;
    if (isDoc(slug)) return true;
    if (slug.startsWith('bin/')) {
      const name = slug.slice(4);
      const c = registry.get(name);
      return c && !c.builtin && !c.doc;
    }
    return false;
  }
  function childrenOf(slug) {
    if (slug === 'bin') {
      return registry.list()
        .filter((c) => !c.builtin && !c.doc)
        .map((c) => ({ name: c.name, dir: false }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    const prefix = slug === '' ? '' : slug + '/';
    const files = new Set();
    const dirs = new Set();
    for (const d of docSlugs) {
      if (prefix === '') {
        const i = d.indexOf('/');
        if (i === -1) files.add(d); else dirs.add(d.slice(0, i));
      } else if (d.startsWith(prefix)) {
        const rest = d.slice(prefix.length);
        const i = rest.indexOf('/');
        if (i === -1) files.add(rest); else dirs.add(rest.slice(0, i));
      }
    }
    return [
      ...(slug === '' ? [{ name: 'bin', dir: true }] : []),
      ...[...dirs].sort().map((name) => ({ name, dir: true })),
      ...[...files].sort().map((name) => ({ name, dir: false })),
    ];
  }

  function resolvePath(name, cwd) {
    const full = name.startsWith('/') ? name : cwd.replace(/\/$/, '') + '/' + name;
    const parts = [];
    for (const seg of full.split('/')) {
      if (seg === '' || seg === '.') continue;
      if (seg === '..') parts.pop();
      else parts.push(seg);
    }
    return parts.join('/');
  }

  function parseLine(line) {
    const argv = [];
    let cur = '', inQuotes = false;
    for (const c of line) {
      if (c === '"') { inQuotes = !inQuotes; continue; }
      if (!inQuotes && /\s/.test(c)) { if (cur) { argv.push(cur); cur = ''; } continue; }
      cur += c;
    }
    if (cur) argv.push(cur);
    return argv;
  }

  function splitPipe(line) {
    const parts = [];
    let cur = '', inQ = false;
    for (const c of line) {
      if (c === '"') { inQ = !inQ; cur += c; }
      else if (c === '|' && !inQ) { parts.push(cur); cur = ''; }
      else cur += c;
    }
    parts.push(cur);
    return parts.map((s) => s.trim()).filter((s) => s.length > 0);
  }

  function commonPrefix(arr) {
    if (arr.length === 0) return '';
    let pre = arr[0];
    for (const w of arr) { while (!w.startsWith(pre)) pre = pre.slice(0, -1); }
    return pre;
  }

  function globMatch(glob, name) {
    const re = new RegExp(
      '^' + glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );
    return re.test(name);
  }

  // ========================================================================
  // Command registry
  // ========================================================================
  const registry = {
    map: new Map(),
    register(cmd) { this.map.set(cmd.name, cmd); },
    get(name) { return this.map.get(name); },
    list() { return [...this.map.values()]; },
  };

  // ========================================================================
  // Terminal wrapper (shell mode + tui mode)
  // ========================================================================
  const termHost = document.getElementById('term-host');
  const termScreen = document.getElementById('term-screen');

  function internalPage(target) {
    if (target.startsWith('#')) return target.slice(1) || null;
    try {
      const u = new URL(target, location.href);
      if (u.origin === location.origin && u.pathname === location.pathname && u.hash) {
        return u.hash.slice(1) || null;
      }
    } catch (e) { /* not a url */ }
    return null;
  }

  let onNavigate = null;

  const xterm = new Terminal({
    fontFamily: 'Monaco, "SF Mono", Menlo, Consolas, "Courier New", monospace',
    fontSize: 14,
    lineHeight: 1.0,
    letterSpacing: 0,
    cursorBlink: true,
    allowProposedApi: true,
    linkHandler: {
      allowNonHttpProtocols: true,
      activate: (_event, target) => {
        const page = internalPage(target);
        if (page !== null) { onNavigate && onNavigate(page); return; }
        window.open(target, '_blank', 'noopener');
      },
    },
    theme: {
      background: '#ffffff',
      foreground: '#111111',
      cursor: '#111111',
      cursorAccent: '#ffffff',
      selectionBackground: '#111111',
      selectionForeground: '#ffffff',
    },
  });

  const fitAddon = new FitAddon.FitAddon();
  xterm.loadAddon(fitAddon);
  try {
    xterm.loadAddon(new Unicode11Addon.Unicode11Addon());
    xterm.unicode.activeVersion = '11';
  } catch (e) { console.warn('unicode11 addon unavailable', e); }
  xterm.open(termScreen);

  let mode = 'shell';
  let shellDataCb = null;
  let tuiKeyCb = null;

  xterm.onData((d) => { if (mode === 'shell') shellDataCb && shellDataCb(d); });
  xterm.onKey((e) => { if (mode === 'tui') tuiKeyCb && tuiKeyCb(e); });

  const term = {
    get cols() { return xterm.cols; },
    get rows() { return xterm.rows; },
    write(s) { xterm.write(String(s).replace(/(?<!\r)\n/g, '\r\n')); },
    print(s) { this.write(s + '\n'); },
    clear() { xterm.clear(); },
    reset() { xterm.reset(); },
    focus() { xterm.focus(); },
    fit() { fitAddon.fit(); },
    onShellData(cb) { shellDataCb = cb; },
    takeOver() {
      mode = 'tui';
      return {
        get cols() { return xterm.cols; },
        get rows() { return xterm.rows; },
        write: (s) => xterm.write(s),
        clear: () => xterm.reset(),
        onKey: (cb) => { tuiKeyCb = cb; },
        release: () => { mode = 'shell'; },
      };
    },
  };

  new ResizeObserver(() => term.fit()).observe(termHost);

  // ========================================================================
  // Shell — REPL with inline line editor
  // ========================================================================
  let cwd = '';
  let curPrompt = '';
  let curWidth = 0;
  let buffer = '';
  let cursor = 0;
  let history = [];
  let histIdx = -1;
  let resolveLine = null;

  function promptFor() {
    const loc = '/' + cwd;
    return {
      text: `\x1b[1m${SITE.user}\x1b[0m@\x1b[1m${SITE.host}\x1b[0m:\x1b[1m${loc}\x1b[0m${DIM}$\x1b[0m `,
      width: `${SITE.user}@${SITE.host}:${loc}$ `.length,
    };
  }

  async function start() {
    term.onShellData((d) => onData(d));
    if (initialCommand) {
      const { text } = promptFor();
      term.write(text + initialCommand + '\r\n');
      await execute(initialCommand);
    }
    for (;;) {
      buffer = ''; cursor = 0; histIdx = -1;
      const { text, width } = promptFor();
      curPrompt = text; curWidth = width;
      term.write(curPrompt);
      const line = await readLine();
      await execute(line);
    }
  }

  function inject(command) {
    if (!resolveLine) return;
    term.write(command + '\r\n');
    const r = resolveLine;
    resolveLine = null;
    r(command);
  }

  function readLine() {
    return new Promise((resolve) => { resolveLine = resolve; });
  }

  async function execute(line) {
    const trimmed = line.trim();
    if (!trimmed) return;
    history.push(trimmed);
    document.title = `~${SITE.user}: ${trimmed}`;

    const segments = splitPipe(trimmed);
    let stdin = '';
    for (let i = 0; i < segments.length; i++) {
      const argv = parseLine(segments[i]);
      const name = argv[0];
      const p = resolvePath(name, cwd);
      const cmd = registry.get(name) ?? registry.get(p) ??
        (p.startsWith('bin/') ? registry.get(p.slice(4)) : undefined);
      if (!cmd) {
        term.print(`command not found: ${name} — try help`);
        return;
      }

      const isLast = i === segments.length - 1;
      let outBuffer = '';
      const stdout = isLast
        ? { write: (s) => term.write(s), print: (s) => term.print(s) }
        : { write: (s) => { outBuffer += s; }, print: (s) => { outBuffer += s + '\n'; } };

      const ctx = {
        term, stdin, stdout, tty: isLast, cwd,
        resolve: (n) => registry.get(n),
        list: () => registry.list(),
        chdir: (t) => chdir(t),
        listDir: (t) => listDir(t),
      };

      try { await cmd.run(ctx, argv); }
      catch (e) { term.print(`error: ${String(e)}`); return; }
      stdin = outBuffer;
    }
  }

  function chdir(target) {
    const p = resolvePath(target, cwd);
    if (isDir(p)) { cwd = p; return null; }
    return `${target}: not a directory`;
  }
  function listDir(target) {
    const p = resolvePath(target, cwd);
    if (p === '') return [{ name: 'bin', dir: true }, ...docSlugs.map((d) => ({ name: d, dir: false }))];
    if (p === 'bin') return childrenOf('bin');
    if (isDoc(p)) return [{ name: p, dir: false }];
    return null;
  }

  // ---- inline line editor ----
  function onData(d) {
    if (!resolveLine) return;
    switch (d) {
      case '\r':
      case '\n': {
        const line = buffer;
        term.write('\r\n');
        const r = resolveLine;
        resolveLine = null;
        r(line);
        break;
      }
      case '\x7f':
      case '\b': {
        if (cursor > 0) {
          const cut = prevClusterStart(buffer, cursor);
          buffer = buffer.slice(0, cut) + buffer.slice(cursor);
          cursor = cut;
          redraw();
        }
        break;
      }
      case '\x1b[A': case '\x1bOA': case '\x10': histMove('up'); break;
      case '\x1b[B': case '\x1bOB': case '\x0e': histMove('down'); break;
      case '\x1b[C': case '\x06':
        if (cursor < buffer.length) { cursor++; gotoCursor(); }
        break;
      case '\x1b[D': case '\x02':
        if (cursor > 0) { cursor--; gotoCursor(); }
        break;
      case '\x01': cursor = 0; gotoCursor(); break;
      case '\x05': cursor = buffer.length; gotoCursor(); break;
      case '\x0b': buffer = buffer.slice(0, cursor); redraw(); break;
      case '\x15': buffer = buffer.slice(cursor); cursor = 0; redraw(); break;
      case '\x17': {
        let i = cursor;
        while (i > 0 && /\s/.test(buffer[i - 1])) i--;
        while (i > 0 && !/\s/.test(buffer[i - 1])) i--;
        buffer = buffer.slice(0, i) + buffer.slice(cursor);
        cursor = i;
        redraw();
        break;
      }
      case '\x04':
        if (buffer.length === 0) { cwd = ''; const r = resolveLine; resolveLine = null; r('index'); return; }
        if (cursor < buffer.length) {
          const end = nextClusterEnd(buffer, cursor);
          buffer = buffer.slice(0, cursor) + buffer.slice(end);
          redraw();
        }
        break;
      case '\x0c': term.write('\x1b[2J\x1b[3J\x1b[H'); redraw(); break;
      case '\x03':
        term.write('^C\r\n');
        if (resolveLine) { const r = resolveLine; resolveLine = null; r(''); }
        break;
      case '\t': complete(); break;
      default:
        if (d.length >= 1 && !/[\x00-\x1f\x7f]/.test(d)) {
          buffer = buffer.slice(0, cursor) + d + buffer.slice(cursor);
          cursor += d.length;
          redraw();
        }
    }
  }

  function histMove(dir) {
    const n = history.length;
    if (n === 0) return;
    if (dir === 'up') histIdx = histIdx === -1 ? n - 1 : Math.max(0, histIdx - 1);
    else {
      if (histIdx === -1) return;
      histIdx++;
      if (histIdx >= n) histIdx = -1;
    }
    const entry = histIdx === -1 ? '' : history[histIdx];
    buffer = entry; cursor = entry.length;
    redraw();
  }

  function complete() {
    const before = buffer.slice(0, cursor);
    const wordStart = before.lastIndexOf(' ') + 1;
    const prefix = before.slice(wordStart);
    const isFirstWord = wordStart === 0;

    const entries = listDir('.') ?? [];
    const names = new Set();
    const dirs = new Set();
    for (const e of entries) { names.add(e.name); if (e.dir) dirs.add(e.name); }
    if (isFirstWord) for (const c of registry.list()) names.add(c.name);

    const matches = [...names].filter((n) => n.startsWith(prefix)).sort();
    if (matches.length === 0) { term.write('\x07'); return; }
    if (matches.length === 1) {
      const m = matches[0];
      replaceWord(wordStart, m + (dirs.has(m) ? '/' : ' '));
      return;
    }
    const lcp = commonPrefix(matches);
    if (lcp.length > prefix.length) { replaceWord(wordStart, lcp); return; }
    term.write('\r\n' + matches.join('  ') + '\r\n');
    redraw();
  }

  function replaceWord(wordStart, replacement) {
    buffer = buffer.slice(0, wordStart) + replacement + buffer.slice(cursor);
    cursor = wordStart + replacement.length;
    redraw();
  }

  function redraw() {
    term.write(`\r\x1b[0K${curPrompt}${buffer}`);
    const back = displayWidth(buffer) - displayWidth(buffer.slice(0, cursor));
    if (back > 0) term.write(`\x1b[${back}D`);
  }
  function gotoCursor() {
    term.write(`\x1b[${curWidth + displayWidth(buffer.slice(0, cursor)) + 1}G`);
  }

  // ========================================================================
  // Commands
  // ========================================================================
  registry.register({
    name: 'ls', description: 'list directory contents: ls [dir]',
    async run(ctx, argv) {
      const target = argv[1] ?? '.';
      const entries = ctx.listDir(target);
      if (!entries) { ctx.stdout.print(`ls: ${target}: not a directory`); return; }
      if (entries.length === 0) { ctx.stdout.print('(empty)'); return; }
      for (const e of entries) {
        const name = e.dir ? `${BOLD}${e.name}/${RESET}` : e.name;
        ctx.stdout.print(`  ${name}`);
      }
    },
  });

  registry.register({
    name: 'cat', description: 'print documents: cat <path> [path...]',
    async run(ctx, argv) {
      const paths = argv.slice(1);
      if (paths.length === 0) { ctx.stdout.print('usage: cat <path> [path...]'); return; }
      for (const path of paths) {
        const doc = DOCS[resolvePath(path, ctx.cwd)];
        if (!doc) { ctx.stdout.print(`cat: ${path}: no such file`); continue; }
        ctx.stdout.write(renderMarkdown(doc, ctx.term.cols));
      }
    },
  });

  registry.register({
    name: 'head', description: 'first lines: head [-n N] [path]',
    async run(ctx, argv) {
      let n = 10, file = null;
      for (let i = 1; i < argv.length; i++) {
        if (argv[i] === '-n' && argv[i + 1]) { n = parseInt(argv[i + 1], 10) || 10; i++; }
        else file = argv[i];
      }
      let text = file ? DOCS[resolvePath(file, ctx.cwd)] : ctx.stdin;
      if (file && !text) { ctx.stdout.print(`head: ${file}: no such file`); return; }
      if (file) text = renderMarkdown(text, ctx.term.cols);
      ctx.stdout.write((text || '').split('\n').slice(0, n).join('\n') + '\n');
    },
  });

  registry.register({
    name: 'tail', description: 'last lines: tail [-n N] [path]',
    async run(ctx, argv) {
      let n = 10, file = null;
      for (let i = 1; i < argv.length; i++) {
        if (argv[i] === '-n' && argv[i + 1]) { n = parseInt(argv[i + 1], 10) || 10; i++; }
        else file = argv[i];
      }
      let text = file ? DOCS[resolvePath(file, ctx.cwd)] : ctx.stdin;
      if (file && !text) { ctx.stdout.print(`tail: ${file}: no such file`); return; }
      if (file) text = renderMarkdown(text, ctx.term.cols);
      ctx.stdout.write((text || '').split('\n').slice(-n).join('\n') + '\n');
    },
  });

  registry.register({
    name: 'grep', description: 'filter lines: grep <pattern> [path]',
    async run(ctx, argv) {
      const pattern = argv[1];
      if (!pattern) { ctx.stdout.print('usage: grep <pattern> [path]'); return; }
      const file = argv[2];
      let lines;
      if (file) {
        const doc = DOCS[resolvePath(file, ctx.cwd)];
        if (!doc) { ctx.stdout.print(`grep: ${file}: no such file`); return; }
        lines = renderMarkdown(doc, 0).split('\n');
      } else {
        lines = ctx.stdin.split('\n');
      }
      const matches = lines.filter((l) => l.includes(pattern));
      if (matches.length) ctx.stdout.write(matches.join('\n') + '\n');
    },
  });

  registry.register({
    name: 'find', description: 'walk the FS: find [path] [-name GLOB] [-type f|d]',
    async run(ctx, argv) {
      let path = '.', nameGlob = null, typeFilter = null;
      for (let i = 1; i < argv.length; i++) {
        if (argv[i] === '-name') { nameGlob = argv[++i]; }
        else if (argv[i] === '-type') { typeFilter = argv[++i]; }
        else if (!argv[i].startsWith('-')) path = argv[i];
      }
      const root = resolvePath(path, ctx.cwd);
      const results = [];
      const walk = (slug) => {
        if (isFile(slug)) {
          const name = slug.split('/').pop();
          const okName = !nameGlob || globMatch(nameGlob, name);
          const okType = !typeFilter || typeFilter === 'f';
          if (okName && okType) results.push(slug);
        }
        const kids = childrenOf(slug);
        for (const k of kids) {
          const child = slug === '' ? k.name : slug + '/' + k.name;
          if (k.dir) {
            const okType = !typeFilter || typeFilter === 'd';
            if (okType && (!nameGlob || globMatch(nameGlob, k.name))) results.push(child);
            walk(child);
          }
        }
      };
      if (root === 'bin') {
        for (const c of registry.list().filter((c) => !c.builtin && !c.doc)) results.push('bin/' + c.name);
      } else if (isDir(root)) walk(root);
      else if (isFile(root)) results.push(root);
      else { ctx.stdout.print(`find: ${path}: no such file or directory`); return; }
      ctx.stdout.write(results.join('\n') + (results.length ? '\n' : ''));
    },
  });

  registry.register({
    name: 'tree', description: 'draw the FS: tree [path]',
    async run(ctx, argv) {
      const root = resolvePath(argv[1] ?? '.', ctx.cwd);
      if (!isDir(root)) { ctx.stdout.print(`tree: ${argv[1] ?? '.'}: not a directory`); return; }
      const out = [root === '' ? '/' : root];
      const walk = (slug, prefix) => {
        const kids = childrenOf(slug);
        kids.forEach((k, i) => {
          const isLast = i === kids.length - 1;
          const connector = isLast ? '\u2514\u2500\u2500 ' : '\u251c\u2500\u2500 ';
          out.push(prefix + connector + k.name + (k.dir ? '/' : ''));
          if (k.dir) {
            const child = slug === '' ? k.name : slug + '/' + k.name;
            walk(child, prefix + (isLast ? '    ' : '\u2502   '));
          }
        });
      };
      walk(root, '');
      ctx.stdout.write(out.join('\n') + '\n');
    },
  });

  registry.register({
    name: 'cd', description: 'change directory: cd <dir>', builtin: true,
    async run(ctx, argv) {
      const err = ctx.chdir(argv[1] ?? '/');
      if (err) ctx.stdout.print(`cd: ${err}`);
    },
  });

  registry.register({
    name: 'pwd', description: 'print working directory', builtin: true,
    async run(ctx) { ctx.stdout.print('/' + ctx.cwd); },
  });

  registry.register({
    name: 'wc', description: 'count lines/words/bytes from stdin',
    async run(ctx) {
      const text = ctx.stdin;
      const lines = text === '' ? 0 : text.split('\n').length;
      const words = text.split(/\s+/).filter(Boolean).length;
      const bytes = new TextEncoder().encode(text).length;
      ctx.stdout.print(`  ${lines}  ${words}  ${bytes}`);
    },
  });

  registry.register({
    name: 'clear', description: 'clear the screen', builtin: true,
    async run(ctx) { ctx.term.write('\x1b[2J\x1b[3J\x1b[H'); },
  });

  registry.register({
    name: 'whoami', description: 'who you are', builtin: true,
    async run(ctx) { ctx.stdout.print(SITE.user); },
  });

  registry.register({
    name: 'exit', description: 'return to the home page', builtin: true,
    async run(ctx) { ctx.chdir('/'); ctx.stdout.write(renderMarkdown(DOCS[SITE.home], ctx.term.cols)); },
  });

  // more / less — the pager (TUI). Shares one implementation.
  async function page(ctx, text) {
    if (!ctx.tty) { ctx.stdout.write(text); return; }
    const s = ctx.term.takeOver();
    const logical = text.split('\n');
    let top = 0;
    let drawnRows = 0;

    const draw = () => {
      s.clear();
      const cols = Math.max(1, s.cols);
      const pageH = Math.max(1, s.rows - 1);
      const wrapped = [];
      for (const ln of logical) wrapped.push(...wrapLine(ln, cols));
      const total = wrapped.length;
      const last = Math.max(0, total - pageH);
      top = Math.min(top, last);
      const vis = wrapped.slice(top, top + pageH);
      drawnRows = vis.length;
      s.write(vis.join('\r\n'));
      const atEnd = top >= last && total > 0;
      const pct = total === 0 ? 100 : Math.min(100, Math.round(((top + pageH) / total) * 100));
      const status = atEnd ? `${DIM}(END)${RESET}` : `${DIM}--More-- ${pct}%${RESET}`;
      s.write(move(0, s.rows - 1) + status);
      return { atEnd, pageH, last };
    };

    const swallow = (e) => {
      if (e.ctrlKey && (e.key === 'd' || e.key === 'u' || e.key === '\x04' || e.key === '\x15')) e.preventDefault();
    };
    window.addEventListener('keydown', swallow, true);

    const STEP = 10;
    let state = draw();
    try {
      await new Promise((resolve) => {
        s.onKey((e) => {
          const dom = e.domEvent;
          if (dom.ctrlKey) {
            const c = dom.key;
            if (c === 'd' || c === 'D' || c === '\x04') top = Math.min(top + STEP, state.last);
            else if (c === 'u' || c === 'U' || c === '\x15') top = Math.max(top - STEP, 0);
            else return;
            state = draw();
            return;
          }
          const k = dom.key;
          if (k === 'q' || k === 'Escape') { resolve(); return; }
          if (k === ' ' || k === 'PageDown' || k === 'f') {
            if (state.atEnd) { resolve(); return; }
            top = Math.min(top + state.pageH, state.last);
          } else if (k === 'b' || k === 'PageUp') top = Math.max(top - state.pageH, 0);
          else if (k === 'ArrowDown' || k === 'j' || k === 'Enter') top = Math.min(top + 1, state.last);
          else if (k === 'ArrowUp' || k === 'k') top = Math.max(top - 1, 0);
          else if (k === 'g') top = 0;
          else if (k === 'G') top = state.last;
          else return;
          state = draw();
        });
      });
    } finally {
      window.removeEventListener('keydown', swallow, true);
    }

    s.write(move(0, drawnRows) + ERASE_BELOW);
    s.release();
  }

  registry.register({
    name: 'more', description: 'page a document or stdin: more [path]',
    async run(ctx, argv) {
      const file = argv[1];
      let text = null;
      if (file) {
        const doc = DOCS[resolvePath(file, ctx.cwd)];
        if (!doc) { ctx.stdout.print(`more: ${file}: no such file`); return; }
        text = renderMarkdown(doc, ctx.term.cols);
      } else if (ctx.stdin) text = ctx.stdin;
      if (text === null) { ctx.stdout.print('usage: more [path]'); return; }
      await page(ctx, text);
    },
  });

  registry.register({
    name: 'less', description: 'page a document or stdin: less [path]',
    async run(ctx, argv) {
      const file = argv[1];
      let text = null;
      if (file) {
        const doc = DOCS[resolvePath(file, ctx.cwd)];
        if (!doc) { ctx.stdout.print(`less: ${file}: no such file`); return; }
        text = renderMarkdown(doc, ctx.term.cols);
      } else if (ctx.stdin) text = ctx.stdin;
      if (text === null) { ctx.stdout.print('usage: less [path]'); return; }
      await page(ctx, text);
    },
  });

  // ---- document commands (one per content file) ----
  for (const slug of docSlugs) {
    registry.register({
      name: slug,
      description: `page · ${slug}`,
      doc: true,
      async run(ctx) {
        if (ctx.tty) ctx.term.write('\x1b[2J\x1b[3J\x1b[H');
        ctx.stdout.write(renderMarkdown(DOCS[slug], ctx.term.cols));
      },
    });
  }

  // ========================================================================
  // Routing (hash-based, so the browser Back button works)
  // ========================================================================
  const commandFromHash = () => location.hash.replace(/^#/, '').trim();
  const initial = commandFromHash() || SITE.home;

  onNavigate = (cmd) => {
    try { history.pushState({ cmd }, '', '#' + cmd); } catch (e) { /* file:// */ }
    inject(cmd);
  };

  window.addEventListener('popstate', (e) => {
    const cmd = (e.state && e.state.cmd) || commandFromHash() || SITE.home;
    inject(cmd);
  });

  try { history.replaceState({ cmd: initial }, '', '#' + initial); } catch (e) { /* file:// */ }

  // ========================================================================
  // Hello boot screen (iPhone-style), then reveal the terminal.
  // ========================================================================
  function playHello(onDone) {
    const screen = document.getElementById('hello-screen');
    const wordEl = screen.querySelector('.hello-word');
    const langEl = document.getElementById('hello-lang');
    const seq = SITE.hellos;
    if (!seq || seq.length === 0) { onDone(); return; }

    langEl.textContent = 'Think different.';
    wordEl.textContent = seq[0];
    let i = 1;

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      screen.classList.add('fade-out');
      setTimeout(onDone, 650);
    };

    const timer = setInterval(() => {
      if (i >= seq.length) { finish(); return; }
      wordEl.textContent = seq[i];
      i++;
    }, 650);

    screen.addEventListener('click', finish);
    // Auto-advance safety net: never strand the user on the splash.
    setTimeout(finish, 650 * seq.length + 400);
  }

  // Reveal the terminal once fitted (hide the pre-JS / font-swap reflow).
  const reveal = () => {
    try { term.fit(); } finally {
      termHost.closest('#mac-window').style.visibility = 'visible';
      term.focus();
    }
  };

  // Start everything after the Hello splash.
  playHello(() => {
    reveal();
    start();
  });

  // Safety net in case fonts/CDN stall — never leave a blank page.
  setTimeout(() => {
    const s = document.getElementById('hello-screen');
    if (s) s.classList.add('fade-out');
  }, 8000);

})();
