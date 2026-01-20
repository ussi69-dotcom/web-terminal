# Lazygit-Inspired Git Panel Implementation Plan

> **For Claude:** Execute this plan using `/subagent-driven-development` (recommended) or `/executing-plans` (manual review).

**Goal:** Upgrade DeckTerm Git panel to lazygit-inspired interface with commit history, diff2html, branch switching, and keyboard shortcuts.

**Architecture:** Extend existing GitManager class with new state management, add 3 backend endpoints (log, checkout, show), integrate diff2html CDN, add keyboard handler.

**Tech Stack:** Bun backend, vanilla JS frontend, diff2html v3.4.48 CDN, existing CSS variables

---

## Phase 1: Backend API Extensions

### Task 1.1: Add GET /api/git/log endpoint

**Files:**

- Modify: `backend/server.ts:1029-1230` (add after existing git endpoints)

**Step 1: Add the endpoint code after line ~1230**

```typescript
// GET /api/git/log?cwd=...&limit=50
app.get("/api/git/log", async (c) => {
  const cwd = c.req.query("cwd") || process.env.HOME;
  const limit = parseInt(c.req.query("limit") || "50");

  if (!cwd || !(await validateGitCwd(cwd))) {
    return c.json({ error: "Forbidden path" }, 403);
  }

  try {
    const proc = Bun.spawn(
      [
        "git",
        "log",
        `--max-count=${Math.min(limit, 200)}`,
        "--format=%h|%H|%s|%an|%aI",
        "--graph",
        "--",
      ],
      {
        cwd,
        stdout: "pipe",
        stderr: "pipe",
      },
    );

    const timeoutId = setTimeout(() => proc.kill(), 10000);
    const output = await new Response(proc.stdout).text();
    clearTimeout(timeoutId);

    const commits = output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        // Parse graph prefix (*, |, etc) and commit data
        const graphMatch = line.match(/^([*|\\ \/]+)\s*(.*)$/);
        const graph = graphMatch ? graphMatch[1] : "";
        const data = graphMatch ? graphMatch[2] : line;

        const parts = data.split("|");
        if (parts.length >= 5) {
          return {
            hash: parts[0],
            fullHash: parts[1],
            message: parts[2],
            author: parts[3],
            date: parts[4],
            graph: graph.trim(),
          };
        }
        return null;
      })
      .filter(Boolean);

    return c.json({ commits, cwd });
  } catch (err) {
    return c.json({ error: "Git log failed", message: String(err) }, 400);
  }
});
```

**Step 2: Test the endpoint manually**

Run:

```bash
curl "http://localhost:4174/api/git/log?cwd=/home/deploy/deckterm_dev&limit=10" | jq
```

Expected: JSON with commits array containing hash, message, author, date, graph fields.

**Step 3: Commit**

```bash
git add backend/server.ts
git commit -m "feat(git): add /api/git/log endpoint for commit history"
```

---

### Task 1.2: Add POST /api/git/checkout endpoint

**Files:**

- Modify: `backend/server.ts` (add after log endpoint)

**Step 1: Add the endpoint code**

```typescript
// POST /api/git/checkout { cwd, branch }
app.post("/api/git/checkout", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { cwd, branch } = body;

  if (!cwd || !(await validateGitCwd(cwd))) {
    return c.json({ error: "Forbidden path" }, 403);
  }

  if (!branch || typeof branch !== "string" || !/^[\w\-\/\.]+$/.test(branch)) {
    return c.json({ error: "Invalid branch name" }, 400);
  }

  try {
    const proc = Bun.spawn(["git", "checkout", "--", branch], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });

    const timeoutId = setTimeout(() => proc.kill(), 10000);
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;
    clearTimeout(timeoutId);

    if (exitCode !== 0) {
      return c.json({ error: "Checkout failed", message: stderr }, 400);
    }

    return c.json({ success: true, branch });
  } catch (err) {
    return c.json({ error: "Git checkout failed", message: String(err) }, 400);
  }
});
```

**Step 2: Test the endpoint manually**

Run:

```bash
curl -X POST "http://localhost:4174/api/git/checkout" \
  -H "Content-Type: application/json" \
  -d '{"cwd":"/home/deploy/deckterm_dev","branch":"develop"}'
```

Expected: `{"success":true,"branch":"develop"}`

**Step 3: Commit**

```bash
git add backend/server.ts
git commit -m "feat(git): add /api/git/checkout endpoint for branch switching"
```

---

### Task 1.3: Add GET /api/git/show endpoint

**Files:**

- Modify: `backend/server.ts` (add after checkout endpoint)

**Step 1: Add the endpoint code**

```typescript
// GET /api/git/show?cwd=...&commit=...&path=...
app.get("/api/git/show", async (c) => {
  const cwd = c.req.query("cwd") || process.env.HOME;
  const commit = c.req.query("commit");
  const path = c.req.query("path");

  if (!cwd || !(await validateGitCwd(cwd))) {
    return c.json({ error: "Forbidden path" }, 403);
  }

  if (!commit || !/^[a-f0-9]{4,40}$/i.test(commit)) {
    return c.json({ error: "Invalid commit hash" }, 400);
  }

  if (!path) {
    return c.json({ error: "Path required" }, 400);
  }

  try {
    const proc = Bun.spawn(["git", "show", `${commit}:${path}`, "--"], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });

    const timeoutId = setTimeout(() => proc.kill(), 10000);
    const content = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    clearTimeout(timeoutId);

    if (exitCode !== 0) {
      return c.json({ error: "File not found at commit" }, 404);
    }

    return c.json({ content, commit, path });
  } catch (err) {
    return c.json({ error: "Git show failed", message: String(err) }, 400);
  }
});
```

**Step 2: Test the endpoint manually**

Run:

```bash
curl "http://localhost:4174/api/git/show?cwd=/home/deploy/deckterm_dev&commit=HEAD&path=package.json" | jq
```

Expected: JSON with content field containing file contents at that commit.

**Step 3: Commit**

```bash
git add backend/server.ts
git commit -m "feat(git): add /api/git/show endpoint for viewing files at commits"
```

---

## Phase 2: Frontend Dependencies

### Task 2.1: Add diff2html CDN

**Files:**

- Modify: `web/index.html`

**Step 1: Add diff2html CSS in head (after xterm.css)**

Find line with xterm.css and add after:

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/diff2html@3.4.48/bundles/css/diff2html.min.css"
/>
```

**Step 2: Add diff2html JS before app.js**

Find the script tags section and add before app.js:

```html
<script src="https://cdn.jsdelivr.net/npm/diff2html@3.4.48/bundles/js/diff2html.min.js"></script>
```

**Step 3: Test CDN loads**

Run:

```bash
curl -s "http://localhost:4174" | grep -o "diff2html"
```

Expected: "diff2html" appears in output.

**Step 4: Commit**

```bash
git add web/index.html
git commit -m "feat(git): add diff2html CDN for improved diff rendering"
```

---

## Phase 3: GitManager Refactor

### Task 3.1: Update GitManager state and panel structure

**Files:**

- Modify: `web/app.js:2516-2700`

**Step 1: Replace the constructor and createPanel methods**

Replace lines ~2519-2561 with:

```javascript
class GitManager {
  constructor() {
    this.panel = null;
    this.state = {
      cwd: null,
      files: { staged: [], modified: [], untracked: [], deleted: [] },
      branches: { current: '', list: [] },
      commits: [],
      selectedIndex: 0,
      activePanel: 'files', // 'files' | 'history' | 'branches'
      diff: null,
      loading: false
    };
    this.init();
  }

  init() {
    this.createPanel();
    document
      .querySelector('[data-action="git"]')
      ?.addEventListener("click", () => this.toggle());
    this.setupKeyboardShortcuts();
  }

  createPanel() {
    this.panel = document.createElement("div");
    this.panel.id = "git-panel";
    this.panel.className = "side-panel hidden";
    this.panel.innerHTML = `
      <div class="git-panel-layout">
        <div class="git-left-panel">
          <div class="panel-header">
            <h3>Git</h3>
            <span id="git-branch" class="git-branch clickable" title="Click to switch branch"></span>
            <button class="panel-refresh" title="Refresh (r)">↻</button>
            <button class="panel-close" title="Close (Esc)">&times;</button>
          </div>
          <div id="git-files" class="git-files"></div>
          <div id="git-branches" class="git-branches hidden"></div>
        </div>
        <div class="git-right-panel">
          <div class="git-diff-header">
            <span id="git-diff-title">Diff</span>
          </div>
          <div id="git-diff" class="git-diff"></div>
          <div class="git-history-header">
            <span>History</span>
          </div>
          <div id="git-history" class="git-history"></div>
        </div>
      </div>
      <div class="git-bottom-bar">
        <div class="git-commit-area">
          <textarea id="git-message" placeholder="Commit message..." rows="2"></textarea>
          <button id="git-commit-btn" class="btn btn-primary">Commit</button>
        </div>
        <div class="git-shortcuts">
          <span><kbd>j</kbd>/<kbd>k</kbd> navigate</span>
          <span><kbd>Space</kbd> stage</span>
          <span><kbd>Enter</kbd> diff</span>
          <span><kbd>c</kbd> commit</span>
          <span><kbd>b</kbd> branches</span>
        </div>
      </div>
    `;
    document.getElementById("app").appendChild(this.panel);

    // Event listeners
    this.panel.querySelector(".panel-close").addEventListener("click", () => this.hide());
    this.panel.querySelector(".panel-refresh").addEventListener("click", () => this.refresh());
    this.panel.querySelector("#git-commit-btn").addEventListener("click", () => this.commit());
    this.panel.querySelector("#git-branch").addEventListener("click", () => this.toggleBranches());
  }
```

**Step 2: Verify panel renders**

Open http://localhost:4174 and click Git button - should see new layout structure (may be unstyled).

**Step 3: Commit**

```bash
git add web/app.js
git commit -m "refactor(git): update GitManager with new panel structure and state"
```

---

### Task 3.2: Add keyboard shortcuts handler

**Files:**

- Modify: `web/app.js` (add method to GitManager class)

**Step 1: Add setupKeyboardShortcuts method after createPanel**

```javascript
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Only handle when git panel is open and not typing in textarea
      if (this.panel.classList.contains('hidden')) return;
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
        if (e.key === 'Escape') {
          e.target.blur();
          return;
        }
        return;
      }

      switch(e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          this.navigateFiles(1);
          break;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          this.navigateFiles(-1);
          break;
        case ' ':
          e.preventDefault();
          this.stageSelectedFile();
          break;
        case 'Enter':
          e.preventDefault();
          this.showSelectedDiff();
          break;
        case 'c':
          e.preventDefault();
          this.panel.querySelector('#git-message').focus();
          break;
        case 'b':
          e.preventDefault();
          this.toggleBranches();
          break;
        case 'r':
          e.preventDefault();
          this.refresh();
          break;
        case 'Tab':
          e.preventDefault();
          this.switchPanel();
          break;
        case 'Escape':
          e.preventDefault();
          this.hide();
          break;
      }
    });
  }

  navigateFiles(delta) {
    const files = this.getAllFiles();
    if (files.length === 0) return;

    this.state.selectedIndex = Math.max(0, Math.min(files.length - 1, this.state.selectedIndex + delta));
    this.highlightSelectedFile();
  }

  getAllFiles() {
    return [
      ...this.state.files.staged,
      ...this.state.files.modified,
      ...this.state.files.untracked,
      ...this.state.files.deleted
    ];
  }

  highlightSelectedFile() {
    const fileElements = this.panel.querySelectorAll('.git-file');
    fileElements.forEach((el, i) => {
      el.classList.toggle('selected', i === this.state.selectedIndex);
    });

    // Scroll into view
    const selected = this.panel.querySelector('.git-file.selected');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  stageSelectedFile() {
    const files = this.getAllFiles();
    const file = files[this.state.selectedIndex];
    if (file) {
      this.toggleStage(file.path, file.staged);
    }
  }

  showSelectedDiff() {
    const files = this.getAllFiles();
    const file = files[this.state.selectedIndex];
    if (file) {
      this.showDiff(file.path);
    }
  }

  switchPanel() {
    const panels = ['files', 'history', 'branches'];
    const currentIndex = panels.indexOf(this.state.activePanel);
    this.state.activePanel = panels[(currentIndex + 1) % panels.length];
    this.updateActivePanelUI();
  }

  updateActivePanelUI() {
    // Visual feedback for active panel
    this.panel.querySelectorAll('.git-left-panel > div, .git-right-panel > div').forEach(el => {
      el.classList.remove('panel-active');
    });

    const activeEl = this.panel.querySelector(`#git-${this.state.activePanel}`);
    if (activeEl) {
      activeEl.classList.add('panel-active');
    }
  }

  toggleBranches() {
    const branchesEl = this.panel.querySelector('#git-branches');
    branchesEl.classList.toggle('hidden');
    if (!branchesEl.classList.contains('hidden')) {
      this.loadBranches();
    }
  }
```

**Step 2: Test keyboard navigation**

Open Git panel, press j/k keys - should navigate (even if visual feedback not working yet).

**Step 3: Commit**

```bash
git add web/app.js
git commit -m "feat(git): add keyboard shortcuts handler for lazygit-style navigation"
```

---

### Task 3.3: Update refresh to group files and load history

**Files:**

- Modify: `web/app.js` (update refresh method)

**Step 1: Replace the refresh method**

```javascript
  async refresh() {
    if (!this.state.cwd) return;
    this.state.loading = true;

    try {
      // Fetch status
      const statusRes = await fetch(`/api/git/status?cwd=${encodeURIComponent(this.state.cwd)}`);
      const statusData = await statusRes.json();

      if (statusData.error) {
        this.panel.querySelector("#git-branch").textContent = "not a repo";
        this.panel.querySelector("#git-files").innerHTML = `<p class="error">${this.escapeHtml(statusData.error)}</p>`;
        return;
      }

      // Group files by status
      this.state.files = { staged: [], modified: [], untracked: [], deleted: [] };
      this.state.branches.current = statusData.branch;

      statusData.files.forEach(f => {
        const file = { path: f.path, status: f.status, staged: false };

        // First char = staged status, second = working tree status
        const staged = f.status[0];
        const unstaged = f.status[1] || ' ';

        if (staged === 'A' || staged === 'M' || staged === 'D' || staged === 'R') {
          file.staged = true;
          this.state.files.staged.push({ ...file, displayStatus: staged });
        }

        if (unstaged === 'M') {
          this.state.files.modified.push({ ...file, displayStatus: 'M' });
        } else if (unstaged === 'D') {
          this.state.files.deleted.push({ ...file, displayStatus: 'D' });
        } else if (f.status === '??') {
          this.state.files.untracked.push({ ...file, displayStatus: '?' });
        }
      });

      this.panel.querySelector("#git-branch").textContent = statusData.branch;
      this.renderFiles();

      // Fetch commit history
      const logRes = await fetch(`/api/git/log?cwd=${encodeURIComponent(this.state.cwd)}&limit=30`);
      const logData = await logRes.json();

      if (!logData.error) {
        this.state.commits = logData.commits || [];
        this.renderHistory();
      }

    } catch (err) {
      console.error("Git refresh error:", err);
    } finally {
      this.state.loading = false;
    }
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
```

**Step 2: Test refresh loads data**

Open Git panel, check console for any errors. Status and history should attempt to load.

**Step 3: Commit**

```bash
git add web/app.js
git commit -m "feat(git): update refresh to group files and fetch commit history"
```

---

### Task 3.4: Add grouped file rendering

**Files:**

- Modify: `web/app.js` (replace renderStatus with renderFiles)

**Step 1: Add renderFiles method**

```javascript
  renderFiles() {
    const container = this.panel.querySelector("#git-files");
    const groups = [
      { key: 'staged', label: 'Staged', icon: '✓', color: 'staged' },
      { key: 'modified', label: 'Modified', icon: 'M', color: 'modified' },
      { key: 'deleted', label: 'Deleted', icon: 'D', color: 'deleted' },
      { key: 'untracked', label: 'Untracked', icon: '?', color: 'untracked' }
    ];

    let html = '';
    let globalIndex = 0;

    groups.forEach(group => {
      const files = this.state.files[group.key];
      if (files.length === 0) return;

      html += `
        <div class="git-file-group">
          <div class="git-file-group-header">
            <span class="git-file-group-icon ${group.color}">${group.icon}</span>
            <span class="git-file-group-label">${group.label}</span>
            <span class="git-file-group-count">(${files.length})</span>
          </div>
          <div class="git-file-group-items">
      `;

      files.forEach(f => {
        const isSelected = globalIndex === this.state.selectedIndex;
        html += `
          <div class="git-file ${isSelected ? 'selected' : ''}" data-path="${this.escapeHtml(f.path)}" data-index="${globalIndex}">
            <span class="git-file-status ${group.color}">${f.displayStatus}</span>
            <span class="git-file-path" title="${this.escapeHtml(f.path)}">${this.escapeHtml(this.truncatePath(f.path))}</span>
            <div class="git-file-actions">
              <button class="git-file-diff" title="View diff">diff</button>
              <button class="git-file-stage" title="${f.staged ? 'Unstage' : 'Stage'}">${f.staged ? '-' : '+'}</button>
            </div>
          </div>
        `;
        globalIndex++;
      });

      html += '</div></div>';
    });

    if (html === '') {
      html = '<p class="muted centered">No changes</p>';
    }

    container.innerHTML = html;

    // Add event listeners
    container.querySelectorAll('.git-file').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.classList.contains('git-file-diff')) {
          this.showDiff(el.dataset.path);
        } else if (e.target.classList.contains('git-file-stage')) {
          const files = this.getAllFiles();
          const file = files[parseInt(el.dataset.index)];
          this.toggleStage(el.dataset.path, file?.staged);
        } else {
          this.state.selectedIndex = parseInt(el.dataset.index);
          this.highlightSelectedFile();
        }
      });
    });
  }

  truncatePath(path, maxLen = 30) {
    if (path.length <= maxLen) return path;
    return '...' + path.slice(-maxLen + 3);
  }
```

**Step 2: Test grouped rendering**

Open Git panel with some modified files - should see them grouped by status.

**Step 3: Commit**

```bash
git add web/app.js
git commit -m "feat(git): add grouped file rendering with status sections"
```

---

### Task 3.5: Add commit history rendering

**Files:**

- Modify: `web/app.js` (add renderHistory method)

**Step 1: Add renderHistory method**

```javascript
  renderHistory() {
    const container = this.panel.querySelector("#git-history");

    if (this.state.commits.length === 0) {
      container.innerHTML = '<p class="muted centered">No commits</p>';
      return;
    }

    const html = this.state.commits.map(commit => `
      <div class="git-commit-item" data-hash="${commit.hash}" title="${this.escapeHtml(commit.message)}">
        <span class="git-commit-graph">${this.escapeHtml(commit.graph)}</span>
        <span class="git-commit-hash">${commit.hash}</span>
        <span class="git-commit-message">${this.escapeHtml(this.truncateMessage(commit.message))}</span>
        <span class="git-commit-date">${this.formatDate(commit.date)}</span>
      </div>
    `).join('');

    container.innerHTML = html;

    // Click to show commit diff
    container.querySelectorAll('.git-commit-item').forEach(el => {
      el.addEventListener('click', () => {
        this.showCommitDiff(el.dataset.hash);
      });
    });
  }

  truncateMessage(msg, maxLen = 50) {
    if (msg.length <= maxLen) return msg;
    return msg.slice(0, maxLen - 3) + '...';
  }

  formatDate(isoDate) {
    const date = new Date(isoDate);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  }

  async showCommitDiff(hash) {
    try {
      const res = await fetch(`/api/git/diff?cwd=${encodeURIComponent(this.state.cwd)}&commit=${hash}`);
      const data = await res.json();

      // For now, just show the commit was clicked (diff rendering comes next)
      this.panel.querySelector('#git-diff-title').textContent = `Commit: ${hash}`;
      this.showDiffContent(data.diff || 'No changes');
    } catch (err) {
      console.error('Commit diff error:', err);
    }
  }
```

**Step 2: Test history rendering**

Open Git panel - should see commit history in bottom right area.

**Step 3: Commit**

```bash
git add web/app.js
git commit -m "feat(git): add commit history rendering with date formatting"
```

---

### Task 3.6: Add diff2html integration

**Files:**

- Modify: `web/app.js` (update showDiff and add showDiffContent methods)

**Step 1: Add/update diff methods**

```javascript
  async showDiff(path) {
    try {
      this.panel.querySelector('#git-diff-title').textContent = path;
      this.panel.querySelector('#git-diff').innerHTML = '<p class="muted">Loading...</p>';

      const res = await fetch(`/api/git/diff?cwd=${encodeURIComponent(this.state.cwd)}&path=${encodeURIComponent(path)}`);
      const data = await res.json();

      if (data.error) {
        this.panel.querySelector('#git-diff').innerHTML = `<p class="error">${this.escapeHtml(data.error)}</p>`;
        return;
      }

      this.showDiffContent(data.diff, path);
    } catch (err) {
      console.error("Diff error:", err);
      this.panel.querySelector('#git-diff').innerHTML = '<p class="error">Failed to load diff</p>';
    }
  }

  showDiffContent(diffText, filename = '') {
    const container = this.panel.querySelector('#git-diff');

    if (!diffText || diffText.trim() === '') {
      container.innerHTML = '<p class="muted centered">No changes</p>';
      return;
    }

    // Check if diff2html is available
    if (typeof Diff2Html !== 'undefined') {
      try {
        const diffHtml = Diff2Html.html(diffText, {
          drawFileList: false,
          matching: 'lines',
          outputFormat: 'line-by-line',
          renderNothingWhenEmpty: false
        });
        container.innerHTML = diffHtml;
        return;
      } catch (err) {
        console.warn('diff2html error, falling back to plain text:', err);
      }
    }

    // Fallback to plain text with basic highlighting
    const lines = diffText.split('\n').map(line => {
      let className = '';
      if (line.startsWith('+') && !line.startsWith('+++')) className = 'diff-add';
      else if (line.startsWith('-') && !line.startsWith('---')) className = 'diff-del';
      else if (line.startsWith('@')) className = 'diff-hunk';
      return `<div class="diff-line ${className}">${this.escapeHtml(line)}</div>`;
    }).join('');

    container.innerHTML = `<pre class="diff-plain">${lines}</pre>`;
  }
```

**Step 2: Test diff2html rendering**

Click "diff" button on a modified file - should see colored diff with diff2html styling.

**Step 3: Commit**

```bash
git add web/app.js
git commit -m "feat(git): integrate diff2html for improved diff rendering"
```

---

### Task 3.7: Add branch list and switching

**Files:**

- Modify: `web/app.js` (add loadBranches and switchBranch methods)

**Step 1: Add branch methods**

```javascript
  async loadBranches() {
    try {
      const res = await fetch(`/api/git/branches?cwd=${encodeURIComponent(this.state.cwd)}`);
      const data = await res.json();

      if (data.error) {
        return;
      }

      this.state.branches.list = data.branches || [];
      this.state.branches.current = data.current || this.state.branches.current;
      this.renderBranches();
    } catch (err) {
      console.error('Load branches error:', err);
    }
  }

  renderBranches() {
    const container = this.panel.querySelector('#git-branches');

    const html = this.state.branches.list.map(branch => {
      const isCurrent = branch === this.state.branches.current;
      return `
        <div class="git-branch-item ${isCurrent ? 'current' : ''}" data-branch="${this.escapeHtml(branch)}">
          <span class="git-branch-icon">${isCurrent ? '●' : '○'}</span>
          <span class="git-branch-name">${this.escapeHtml(branch)}</span>
        </div>
      `;
    }).join('');

    container.innerHTML = html || '<p class="muted">No branches</p>';

    // Add click handlers
    container.querySelectorAll('.git-branch-item:not(.current)').forEach(el => {
      el.addEventListener('click', () => {
        this.switchBranch(el.dataset.branch);
      });
    });
  }

  async switchBranch(branch) {
    if (branch === this.state.branches.current) return;

    try {
      const res = await fetch('/api/git/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd: this.state.cwd, branch })
      });

      const data = await res.json();

      if (data.error) {
        alert(`Checkout failed: ${data.error}`);
        return;
      }

      // Refresh everything
      await this.refresh();
      this.toggleBranches(); // Hide branch list
    } catch (err) {
      console.error('Switch branch error:', err);
      alert('Failed to switch branch');
    }
  }
```

**Step 2: Test branch switching**

Click on branch name in header, select different branch - should switch and refresh.

**Step 3: Commit**

```bash
git add web/app.js
git commit -m "feat(git): add branch list and switching functionality"
```

---

### Task 3.8: Update toggleStage method

**Files:**

- Modify: `web/app.js` (update existing toggleStage method)

**Step 1: Update toggleStage method**

```javascript
  async toggleStage(path, isCurrentlyStaged) {
    try {
      const endpoint = isCurrentlyStaged ? '/api/git/unstage' : '/api/git/stage';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd: this.state.cwd, paths: [path] })
      });

      const data = await res.json();

      if (data.error) {
        console.error('Stage/unstage error:', data.error);
        return;
      }

      // Refresh file list
      await this.refresh();
    } catch (err) {
      console.error('Toggle stage error:', err);
    }
  }
```

**Step 2: Update show method**

```javascript
  async show(cwd) {
    this.state.cwd = cwd || document.getElementById("directory")?.value || "~";
    this.panel.classList.remove("hidden");
    this.state.selectedIndex = 0;
    await this.refresh();
  }
```

**Step 3: Commit**

```bash
git add web/app.js
git commit -m "feat(git): update stage/unstage and show methods"
```

---

## Phase 4: Styling

### Task 4.1: Add new CSS for lazygit layout

**Files:**

- Modify: `web/styles.css` (add after existing git styles ~line 2034)

**Step 1: Add CSS for new layout**

```css
/* Lazygit-inspired Git Panel Layout */
#git-panel.side-panel {
  width: 800px;
  max-width: 100vw;
}

@media (max-width: 900px) {
  #git-panel.side-panel {
    width: 100vw;
  }
}

.git-panel-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  height: calc(100% - 100px);
  overflow: hidden;
}

@media (max-width: 600px) {
  .git-panel-layout {
    grid-template-columns: 1fr;
  }

  .git-right-panel {
    display: none;
  }
}

.git-left-panel {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-primary);
  overflow: hidden;
}

.git-right-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.git-files {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.git-branches {
  max-height: 200px;
  overflow-y: auto;
  padding: 8px;
  border-top: 1px solid var(--border-primary);
  background: var(--bg-tertiary);
}

.git-branches.hidden {
  display: none;
}

/* File groups */
.git-file-group {
  margin-bottom: 12px;
}

.git-file-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.git-file-group-icon {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  padding: 2px 4px;
  border-radius: 3px;
}

.git-file-group-icon.staged {
  background: rgba(63, 185, 80, 0.2);
  color: var(--accent-green);
}
.git-file-group-icon.modified {
  background: rgba(227, 179, 65, 0.2);
  color: #e3b341;
}
.git-file-group-icon.deleted {
  background: rgba(248, 81, 73, 0.2);
  color: #f85149;
}
.git-file-group-icon.untracked {
  background: rgba(139, 148, 158, 0.2);
  color: var(--text-secondary);
}

.git-file-group-items {
  padding-left: 4px;
}

/* File items */
.git-file {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}

.git-file:hover {
  background: var(--bg-hover);
}

.git-file.selected {
  background: var(--accent-blue);
  background: rgba(88, 166, 255, 0.15);
  outline: 1px solid var(--accent-blue);
}

.git-file-path {
  flex: 1;
  font-size: 12px;
  font-family: "JetBrains Mono", monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.git-file-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.git-file:hover .git-file-actions,
.git-file.selected .git-file-actions {
  opacity: 1;
}

.git-file-diff,
.git-file-stage {
  padding: 2px 6px;
  font-size: 10px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  transition: all 0.15s;
}

.git-file-diff:hover,
.git-file-stage:hover {
  background: var(--accent-blue);
  color: white;
}

/* Diff viewer */
.git-diff-header,
.git-history-header {
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-primary);
}

.git-diff {
  flex: 1;
  overflow: auto;
  padding: 8px;
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  line-height: 1.5;
}

/* diff2html overrides for dark theme */
.d2h-wrapper {
  background: transparent !important;
}

.d2h-file-wrapper {
  border: none !important;
  margin: 0 !important;
}

.d2h-file-header {
  display: none !important;
}

.d2h-code-linenumber,
.d2h-code-line {
  background: transparent !important;
  border: none !important;
}

.d2h-del {
  background: rgba(248, 81, 73, 0.15) !important;
}

.d2h-ins {
  background: rgba(63, 185, 80, 0.15) !important;
}

.d2h-info {
  background: rgba(88, 166, 255, 0.1) !important;
  color: var(--accent-blue) !important;
}

/* Plain diff fallback */
.diff-plain {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.diff-line.diff-add {
  background: rgba(63, 185, 80, 0.15);
  color: var(--accent-green);
}

.diff-line.diff-del {
  background: rgba(248, 81, 73, 0.15);
  color: #f85149;
}

.diff-line.diff-hunk {
  color: var(--accent-blue);
  font-weight: 600;
}

/* History */
.git-history {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
}

.git-commit-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.15s;
}

.git-commit-item:hover {
  background: var(--bg-hover);
}

.git-commit-graph {
  color: var(--accent-green);
  white-space: pre;
  min-width: 20px;
}

.git-commit-hash {
  color: var(--accent-yellow);
  min-width: 60px;
}

.git-commit-message {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}

.git-commit-date {
  color: var(--text-secondary);
  font-size: 10px;
  min-width: 50px;
  text-align: right;
}

/* Branch list */
.git-branch-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}

.git-branch-item:hover {
  background: var(--bg-hover);
}

.git-branch-item.current {
  background: rgba(88, 166, 255, 0.1);
  cursor: default;
}

.git-branch-icon {
  color: var(--accent-blue);
}

.git-branch-name {
  font-size: 12px;
  font-family: "JetBrains Mono", monospace;
}

.git-branch.clickable {
  cursor: pointer;
}

.git-branch.clickable:hover {
  text-decoration: underline;
}

/* Bottom bar */
.git-bottom-bar {
  border-top: 1px solid var(--border-primary);
  padding: 8px 12px;
  background: var(--bg-tertiary);
}

.git-commit-area {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.git-commit-area textarea {
  flex: 1;
  resize: none;
  padding: 8px;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
}

.git-commit-area textarea:focus {
  outline: none;
  border-color: var(--accent-blue);
}

.git-shortcuts {
  display: flex;
  gap: 16px;
  font-size: 10px;
  color: var(--text-secondary);
}

.git-shortcuts kbd {
  padding: 2px 4px;
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: 3px;
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
}

/* Utility */
.muted {
  color: var(--text-secondary);
}

.centered {
  text-align: center;
  padding: 20px;
}

.panel-active {
  box-shadow: inset 0 0 0 1px var(--accent-blue);
}
```

**Step 2: Verify styling**

Refresh page and open Git panel - should see lazygit-inspired layout.

**Step 3: Commit**

```bash
git add web/styles.css
git commit -m "feat(git): add CSS for lazygit-inspired panel layout"
```

---

## Phase 5: Testing

### Task 5.1: Create E2E test for Git panel

**Files:**

- Create: `tests/git-panel.spec.ts`

**Step 1: Write the test file**

```typescript
import { test, expect } from "@playwright/test";

const APP_URL = "http://localhost:4174";

test.describe("Git Panel - Lazygit-inspired", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForSelector("#terminal", { state: "visible" });
  });

  test("should open git panel and show file status", async ({ page }) => {
    // Click git button
    await page.click('[data-action="git"]');

    // Panel should be visible
    await expect(page.locator("#git-panel")).toBeVisible();

    // Should show branch name
    await expect(page.locator("#git-branch")).not.toBeEmpty();
  });

  test("should display commit history", async ({ page }) => {
    await page.click('[data-action="git"]');
    await page.waitForSelector("#git-panel:not(.hidden)");

    // Wait for history to load
    await page.waitForTimeout(500);

    // Should have commit items
    const commits = page.locator(".git-commit-item");
    await expect(commits.first()).toBeVisible({ timeout: 5000 });
  });

  test("should navigate with keyboard shortcuts", async ({ page }) => {
    await page.click('[data-action="git"]');
    await page.waitForSelector("#git-panel:not(.hidden)");
    await page.waitForTimeout(300);

    // Press 'j' to navigate down
    await page.keyboard.press("j");

    // Press 'Escape' to close
    await page.keyboard.press("Escape");
    await expect(page.locator("#git-panel")).toHaveClass(/hidden/);
  });

  test("should show diff when clicking diff button", async ({ page }) => {
    await page.click('[data-action="git"]');
    await page.waitForSelector("#git-panel:not(.hidden)");

    // If there are modified files, click diff
    const diffBtn = page.locator(".git-file-diff").first();
    if (await diffBtn.isVisible()) {
      await diffBtn.click();

      // Diff area should have content
      await expect(page.locator("#git-diff")).not.toBeEmpty();
    }
  });

  test("should toggle branch list", async ({ page }) => {
    await page.click('[data-action="git"]');
    await page.waitForSelector("#git-panel:not(.hidden)");

    // Click branch to toggle list
    await page.click("#git-branch");

    // Branch list should be visible
    await expect(page.locator("#git-branches")).not.toHaveClass(/hidden/);
  });
});
```

**Step 2: Run the tests**

```bash
cd /home/deploy/deckterm_dev && npx playwright test tests/git-panel.spec.ts --reporter=list
```

Expected: Tests pass or fail gracefully with clear errors.

**Step 3: Commit**

```bash
git add tests/git-panel.spec.ts
git commit -m "test(git): add E2E tests for lazygit-inspired git panel"
```

---

### Task 5.2: Manual testing checklist

**Step 1: Test all features manually**

- [ ] Open Git panel with toolbar button
- [ ] See grouped files (staged/modified/untracked)
- [ ] Navigate files with j/k keys
- [ ] Stage file with Space key
- [ ] View diff with Enter key
- [ ] See diff2html colored output
- [ ] Click branch name to see branch list
- [ ] Switch to different branch
- [ ] See commit history with dates
- [ ] Click commit to see its diff
- [ ] Focus commit message with 'c' key
- [ ] Close panel with Escape
- [ ] Responsive on mobile (panel takes full width)

**Step 2: Fix any issues found**

Document issues and fix them.

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(git): complete lazygit-inspired git panel implementation"
```

---

## Summary

| Phase | Tasks   | Description                       |
| ----- | ------- | --------------------------------- |
| 1     | 1.1-1.3 | Backend API (log, checkout, show) |
| 2     | 2.1     | diff2html CDN integration         |
| 3     | 3.1-3.8 | GitManager refactor with new UI   |
| 4     | 4.1     | CSS styling for new layout        |
| 5     | 5.1-5.2 | E2E tests and manual verification |

**Total tasks:** 13 tasks across 5 phases
