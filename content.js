// ==========================================================================
// content.js — your site content & configuration.
// Each document is ALSO a command: typing its slug (e.g. `bio`) opens it,
// `cat bio` prints it, and it shows up in `ls` / `tree`.
//
// ▸ EDIT THIS FILE to add your own pages. Put markdown in DOCS below.
//   The directory structure is implied by the slug: "blog/hello" becomes a
//   page reachable via `blog/hello` and visible in `tree` under `blog/`.
// ==========================================================================

window.SITE = {
  // Who you are — used in the prompt and the title bar.
  user: 'you',
  host: 'macintosh',

  // The command run automatically on load (the homepage).
  home: 'index',

  // The "Hello" boot sequence. `hellos` cycles in order before the terminal
  // appears. Keep it short — it's the iPhone-style splash.
  hellos: [
    'Hello',
    '你好',
    'こんにちは',
    'Bonjour',
    'Hallo',
    'Hola',
    'Ciao',
    'Olá',
  ],
};

window.DOCS = {
  // ------------------------------------------------------------------ index
  index: `# 你的名字 your@email.com

> 👤 [About](#bio) · 🚀 [Projects](#projects) · ✉️ [Contact](#contact)

**OS Developer** · hobby kernels · compilers · graphics

*I build low-level systems and think about how computers really work.*

- This page is also a shell.
  Try: \`help\`, \`ls\`, \`tree bin/ | less\`, \`bio\`.
`,

  // ------------------------------------------------------------------- help
  help: `# Help

This site is a terminal. Documents are commands — \`index\`, \`bio\`,
\`projects\` — and tools live in \`/bin\`.

## commands

- \`ls [dir]\`    list a directory (try \`ls /bin\`)
- \`cat <path>\`  print a document (no clear; pipe-friendly)
- \`head [path]\` first lines (\`head -n 5 index\`)
- \`tail [path]\` last lines (\`tail -n 3 index\`)
- \`grep <pat>\`  filter lines (\`cat index | grep shell\`)
- \`find [path]\` walk the virtual filesystem
- \`tree [path]\` draw the filesystem as a tree
- \`more [path]\` page a document (space/b/q)
- \`less [path]\` pager with PageUp/PageDown
- \`cd <dir>\`    change directory (\`cd /bin\`, \`cd ..\`, \`cd /\`)
- \`pwd\`         print working directory
- \`wc\`          count lines/words/bytes
- \`clear\`       clear the screen
- \`whoami\`      who you are
- \`exit\`        return to the home page

## tips

- Run a page like \`index\` to open it (clears the screen).
- Pipes work: \`cat index | wc -l\`.
- History: ↑/↓ or Ctrl-P/N. Cancel: Ctrl-C. Clear: Ctrl-L.
- Tab completes commands and filenames.
`,

  // -------------------------------------------------------------------- bio
  bio: `# About

*A short biography goes here.*

## who

I'm a systems developer. This is where you describe yourself.

## what I do

- kernels & operating systems
- compilers & language runtimes
- low-level graphics

## contact

- email: your@email.com
- github: [github.com/yourname](https://github.com/yourname)
`,

  // -------------------------------------------------------------- projects
  projects: `# Projects

## project one

Description of the first project. Link: [repo](https://github.com/yourname/project).

## project two

Description of the second project.
`,

  // ---------------------------------------------------------------- contact
  contact: `# Contact

- **email** — your@email.com
- **github** — [github.com/yourname](https://github.com/yourname)
- **blog** — [yourname.dev](https://yourname.dev)
`,
};
