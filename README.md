# Question Bank

**English** | [简体中文](README.zh-CN.md)

A desktop app for reviewing interview questions. Read every question with its answer, or recite them one at a time as shuffled flashcards. Works fully offline on Windows and macOS — no account, no server.

Built with Electron, React and TypeScript. Data is stored locally in SQLite.

## Download

Get the latest version from [Releases](https://github.com/Hongyu3273/question-bank/releases/latest): the `.exe` for Windows, or the `.dmg` for your Mac's chip (`arm64` for Apple silicon, `x64` for Intel). The app isn't code-signed; the release notes explain how to open it the first time.

## Features

- **Read mode** — all questions and answers from the selected banks in one scrolling page, with a collapsible, resizable table of contents, full-text search (`Ctrl+F`), and a focus view that shows a single question large with ←/→ navigation. Remembers where you stopped.
- **Recite · Today (spaced repetition)** — scheduled with the FSRS algorithm. After seeing the answer, rate yourself Forgot / Unsure / Got it (`1` / `2` / `3`): forgotten questions come back in 10 minutes, remembered ones at growing intervals. Each bank has its own daily limits for new questions and reviews, new questions are introduced by priority, and you can learn more or review ahead once you're done. `Ctrl+Z` undoes a rating.
- **Recite · Go through all** — shuffle the selected banks and go through every question, handy before an interview. Ratings still count toward spaced repetition.
- **Study overview** — Home shows your streak, ratings over the last 7 days, what's due in the next 7 days and progress per bank.
- **Quick edit** — click Edit or press `E` while reading or reciting to fix the current question in place; remove questions from mistakes by hand.
- **Hide answers** — in Read mode, show only the questions and reveal answers on click to test yourself.
- **Daily automatic backup** — a backup is made the first time you open the app each day (last 7 kept) and can be restored from Settings; errors are written to a log file.
- **Mistakes** — questions you mark Forgot are collected automatically and removed after you mark Got it on two different days. Practise them on their own from Home.
- **Priorities** — each question can have a priority (High / Medium / Low), category, English prompt and source, shown as tags. Filter by priority on Home or right inside Read mode (including *Not set*). Set them per question in the editor, or for a whole bank at once (*Set priority for all…* in the bank menu) — handy for imported banks that have none.
- **Bank management** — create, rename, reorder (drag or `Alt+↑/↓`) and delete banks and questions. Markdown editor with toolbar, preview, code highlighting, tables, LaTeX math and pasted images.
- **Import / export** — Markdown zip (with images), single `.md`, or Excel `.xlsx`; select many files at once. Problems are reported by question and line number; name clashes let you overwrite, keep both or skip. Exports use the same format.
- **Backup & restore** — everything (banks, images, progress, settings) in one `.qbak` file.
- **Settings** — light / dark / system theme, three font sizes, Chinese or English interface, show or hide English prompts.
- Exam mode is shown in the menu but not available yet.

## How to use

1. **Get your questions in.** Open **Banks** → **Import** and pick one or more `.zip`, `.md` or `.xlsx` files. Or click **New bank** and type questions in yourself. Templates are under **Settings → Data**.
2. **Choose what to study.** On **Home**, tick the banks you want under *Choose banks*. Optionally pick a priority (for example only *High*). If an imported bank has no priorities, use *Set priority for all…* in its menu under **Banks** first.
3. **Pick a mode.**
   - **Read** to go through everything with answers visible. Click a question title (or the expand icon) for the focus view; use ← / → to move on, `Esc` to close.
   - **Recite** to test yourself. Think of the answer, click the dashed area (or press `Space`) to check, then rate yourself with `1` / `2` / `3`.
4. **Fix things as you go.** Edit a question in **Banks**; changes appear everywhere. Press `?` anywhere to see all keyboard shortcuts.
5. **Keep your data safe.** **Settings → Data → Export backup** creates a `.qbak` file you can restore on another computer.

## Question bank format

A bank is a folder containing `questions.md` and an optional `images/` folder, zipped:

```
Java basics.zip
└─ Java basics/
   ├─ questions.md
   └─ images/
      └─ hashmap.png
```

`questions.md`:

````markdown
# Java basics

## What is the underlying structure of HashMap?

---answer---

Since JDK 8: **array + linked list + red-black tree**.

```java
Map<String, Integer> map = new HashMap<>();
```

![](images/hashmap.png)

## Why is String immutable?

---answer---

String pool, cached hash code, thread safety.
````

- `#` — bank name (first line)
- `##` — starts a question; the heading text is the question
- `---answer---` — everything after it, up to the next `##`, is the answer. Use `###` for headings inside answers.
- Optional metadata at the top of an answer is shown as tags:

  ```markdown
  *English: Tell me about yourself.*

  > 优先级：高 ｜ 分类：HR ｜ 出处：SEEK
  ```

Excel: first sheet, header row with **Question** and **Answer** columns (or 题干 / 答案), one question per row. Optional columns **Priority**, **Category**, **English**, **Source** (优先级 / 分类 / 英文题干 / 出处) become the metadata line.

Questions without a priority are still imported; they appear under *Not set* and can be given a priority later.

## Development

Requires [Node.js](https://nodejs.org/) 22.12+ and Git.

```bash
npm install     # install dependencies (downloads Electron)
npm run dev     # start the app with hot reload
```

| Command | Purpose |
|---|---|
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` | TypeScript checks |
| `npm run build` | Build to `out/` |
| `npm run dist:win` | Windows installer in `dist/` |
| `npm run dist:mac` | macOS installer in `dist/` (run on a Mac) |

### Releasing a new version

1. Bump `version` in `package.json`, e.g. `1.0.1`.
2. Write the notes in `release-notes/v1.0.1.md`.
3. Commit and push to main.

When GitHub Actions sees a new version number it runs the tests, builds on Windows and macOS, uploads to Releases and publishes. Installed copies pick up the update automatically.

On Windows, if PowerShell says scripts are disabled, run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

### Project layout

```
src/
├─ shared/     types, IPC contract, metadata parsing (main + renderer)
├─ main/       Electron main process: window, SQLite (sql.js), import/export, backup
├─ preload/    exposes a typed window.api to the renderer
└─ renderer/   React UI: pages, components, stores, i18n (zh-CN / en)
tests/         Vitest unit tests
```

User data lives in the OS app-data folder (`%APPDATA%\知识题库\` on Windows, `~/Library/Application Support/知识题库/` on macOS): `app.db` plus `assets/<bank id>/images/`.

### Design notes

- **Security**: context isolation, sandboxed renderer, no Node in the UI; raw HTML in Markdown is never rendered; zip imports reject unsafe paths and oversized entries.
- **Database**: sql.js (SQLite compiled to WebAssembly), so there is nothing to compile on install. Writes are saved atomically (temp file + rename). Schema upgrades run automatically.
- **Large banks**: read mode renders answers lazily and uses `content-visibility`; tested with 1,200+ questions and 500+ images.

## Roadmap

| Milestone | Status |
|---|---|
| M1 App shell, database, settings | ✅ |
| M2 Bank management and editor | ✅ |
| M3 Read mode | ✅ |
| M4 Recite mode | ✅ |
| Spaced repetition | ✅ |
| M5 Import / export / backup | ✅ |
| M6 Settings and i18n | ✅ |
| M7 Installers, GitHub Releases, auto-update | ✅ |
