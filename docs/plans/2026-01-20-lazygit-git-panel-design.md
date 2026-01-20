# Lazygit-Inspired Git Panel Design

> Date: 2026-01-20
> Status: Approved
> Scope: Lazygit-inspired (commit history, improved diff, branch list, keyboard shortcuts)

## Overview

Upgrade DeckTerm's Git panel from basic status/commit to a lazygit-inspired interface with:

- Grouped file tree (staged/modified/untracked)
- Commit history with ASCII graph
- Branch list with switching
- diff2html for beautiful diffs
- Keyboard shortcuts for power users

## Current State

The existing Git panel (`web/app.js:2516-2696`, `backend/server.ts:1029-1230`) provides:

- ✅ File status list (M/A/D/?)
- ✅ Stage/unstage individual files
- ✅ Plain text diff view
- ✅ Commit with message
- ❌ No commit history
- ❌ No branch switching
- ❌ No keyboard navigation
- ❌ Basic diff rendering

## Target Layout

```
+---------------------------+----------------------------+
| 📁 FILES                  |       DIFF VIEWER          |
| ─────────────────────     |  @@ -1,5 +1,6 @@          |
| ▼ Staged (2)              |  - old line                |
|   ✓ app.js                |  + new line                |
|   ✓ style.css             |                            |
| ▼ Modified (3)            |  [diff2html rendered]      |
|   M server.ts             |                            |
| ▼ Untracked (1)           |                            |
|   ? new-file.txt          |                            |
| ─────────────────────     +----------------------------+
| 🌿 BRANCHES               |     COMMIT HISTORY         |
|   ● develop (current)     | * 8d5199a fix(mobile):...  |
|     main                  | * 2ac2ff1 process input... |
|     feature/xyz           | | * feature branch...      |
+---------------------------+----------------------------+
| Commit: [_______________] | [c]ommit [p]ush [space]stage
+---------------------------+----------------------------+
```

## Backend API Changes

### New Endpoints

#### 1. GET `/api/git/log`

```typescript
// Query: ?cwd=/path&limit=50
// Response:
{
  commits: [
    {
      hash: "8d5199a",
      fullHash: "8d5199a1b2c3d4e5...",
      message: "fix(mobile): keep modifiers toggled",
      author: "user",
      date: "2026-01-19T10:30:00Z",
      graph: "* ", // ASCII graph prefix
    },
  ];
}
```

#### 2. POST `/api/git/checkout`

```typescript
// Body: { cwd: "/path", branch: "main" }
// Response: { success: true, branch: "main" }
```

#### 3. GET `/api/git/show`

```typescript
// Query: ?cwd=/path&commit=abc123&path=file.js
// Response: { content: "file contents at that commit" }
```

### Existing Endpoints (unchanged)

- `GET /api/git/status`
- `GET /api/git/diff`
- `POST /api/git/stage`
- `POST /api/git/unstage`
- `POST /api/git/commit`
- `GET /api/git/branches`

## Frontend Architecture

### File Structure

```
web/
├── app.js                    # GitManager refactored
├── lib/
│   └── diff2html.min.js      # Diff rendering library
└── styles.css                # Extended git panel styles
```

### Components (within GitManager class)

1. **FileTree** - Grouped file list with collapsible sections
2. **DiffViewer** - diff2html integration with syntax highlighting
3. **CommitHistory** - Scrollable log with ASCII graph
4. **BranchList** - Branch selector with checkout
5. **KeyboardHandler** - Shortcut management

### State Management

```javascript
class GitManager {
  state = {
    cwd: null,
    files: { staged: [], modified: [], untracked: [] },
    branches: { current: "", list: [] },
    commits: [],
    selectedFile: null,
    activePanel: "files", // 'files' | 'history'
    diff: null,
  };
}
```

## Keyboard Shortcuts

| Key       | Action             | Context       |
| --------- | ------------------ | ------------- |
| `j` / `↓` | Next item          | Files/History |
| `k` / `↑` | Previous item      | Files/History |
| `Space`   | Stage/unstage      | Files         |
| `Enter`   | View diff          | Files         |
| `c`       | Focus commit input | Global        |
| `Tab`     | Switch panel       | Global        |
| `Escape`  | Close panel        | Global        |
| `r`       | Refresh            | Global        |
| `b`       | Toggle branches    | Global        |

## Dependencies

### Add

- **diff2html** v3.4.48 (~50KB minified)
  - CDN: `https://cdn.jsdelivr.net/npm/diff2html/bundles/js/diff2html.min.js`
  - CSS: `https://cdn.jsdelivr.net/npm/diff2html/bundles/css/diff2html.min.css`

### Keep

- Lucide Icons (existing)
- xterm.js (existing)

## Styling

### Color Scheme (matches terminal theme)

```css
:root {
  --git-staged: #98c379; /* Green */
  --git-modified: #e5c07b; /* Yellow/Orange */
  --git-deleted: #e06c75; /* Red */
  --git-untracked: #abb2bf; /* Gray */
  --git-branch-current: #61afef; /* Blue */
}
```

### Layout

- Left panel: 300px (files + branches)
- Right panel: flexible (diff + history)
- Commit bar: bottom, full width
- Total panel width: 800px (or 100% on mobile)

## Security Considerations

All new endpoints follow existing security patterns:

- Realpath validation
- Path containment check against `ALLOWED_GIT_ROOTS`
- Command injection prevention with `--` separator
- 10-second timeout
- Input sanitization

## Testing Strategy

1. **Unit tests** for new backend endpoints
2. **E2E tests** for:
   - File staging/unstaging with keyboard
   - Branch switching
   - Commit history navigation
   - Diff viewing

## Out of Scope (Future)

- Push/Pull to remote
- Merge conflict resolution
- Partial hunk staging
- Stash management
- Interactive rebase
- Git graph visualization (SVG)

## Success Criteria

- [ ] Commit history visible with 50+ commits
- [ ] Branch switching works
- [ ] diff2html renders colored diffs
- [ ] Keyboard navigation works
- [ ] Mobile responsive
- [ ] No performance regression
