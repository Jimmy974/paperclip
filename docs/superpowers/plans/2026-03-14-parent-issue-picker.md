# Parent Issue Picker Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Parent issue" pill to the bottom toolbar of `NewIssueDialog` so users can link a new issue to an existing issue at creation time.

**Architecture:** All changes are in a single file — `NewIssueDialog.tsx`. The parent picker follows the exact same `InlineEntitySelector` pattern as the existing Project selector. Issues are fetched for the company when the dialog is open and filtered client-side by identifier + title. `parentId` flows through state → draft → submit payload.

**Tech Stack:** React, TypeScript, TanStack Query (`useQuery`), `InlineEntitySelector` component, `issuesApi.list()`, Unicode `⤴` character (no new icon imports needed)

---

## Chunk 1: State, draft, and reset

### Task 0: Add `parentId` to `NewIssueDefaults` in DialogContext

**Files:**
- Modify: `ui/src/context/DialogContext.tsx:3-11` (NewIssueDefaults interface)

- [ ] **Step 1: Add `parentId?: string` to `NewIssueDefaults`**

In `ui/src/context/DialogContext.tsx`, the `NewIssueDefaults` interface (lines 3–11) currently does not have `parentId`. Add it:

```typescript
interface NewIssueDefaults {
  status?: string;
  priority?: string;
  projectId?: string;
  assigneeAgentId?: string;
  assigneeUserId?: string;
  title?: string;
  description?: string;
  parentId?: string;           // ← add this
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/context/DialogContext.tsx
git commit -m "feat(ui): add parentId to NewIssueDefaults"
```

---

### Task 1: Add `parentId` to `IssueDraft` and component state

**Files:**
- Modify: `ui/src/components/NewIssueDialog.tsx:66-78` (IssueDraft interface)
- Modify: `ui/src/components/NewIssueDialog.tsx:183` (state declarations)
- Modify: `ui/src/components/NewIssueDialog.tsx:402-418` (reset function)
- Modify: `ui/src/components/NewIssueDialog.tsx:420-429` (handleCompanyChange)

- [ ] **Step 1: Add `parentId` to IssueDraft interface**

In `ui/src/components/NewIssueDialog.tsx`, find the `IssueDraft` interface (line 66). Add one line after `projectId: string;`:

```typescript
  projectId: string;
  parentId?: string;           // ← add this line
  assigneeModelOverride: string;
```

Do not replace the whole interface — only insert this one line.

- [ ] **Step 2: Add `parentId` state after `projectId` state (line ~183)**

```typescript
const [projectId, setProjectId] = useState("");
const [parentId, setParentId] = useState("");   // ← add this
```

- [ ] **Step 3: Add `setParentId("")` to the `reset()` function**

Find `function reset()` (~line 402). Add the reset line after `setProjectId("")`:

```typescript
function reset() {
  setTitle("");
  setDescription("");
  setStatus("todo");
  setPriority("");
  setAssigneeValue("");
  setProjectId("");
  setParentId("");             // ← add this
  setAssigneeOptionsOpen(false);
  // ...rest unchanged
}
```

- [ ] **Step 4: Add `setParentId("")` to `handleCompanyChange()`**

Find `function handleCompanyChange(companyId: string)` (~line 420). Add after `setProjectId("")`:

```typescript
function handleCompanyChange(companyId: string) {
  if (companyId === effectiveCompanyId) return;
  setDialogCompanyId(companyId);
  setAssigneeValue("");
  setProjectId("");
  setParentId("");             // ← add this
  // ...rest unchanged
}
```

- [ ] **Step 5: Commit**

```bash
git add ui/src/components/NewIssueDialog.tsx
git commit -m "feat(ui): add parentId state and draft field to NewIssueDialog"
```

---

### Task 2: Wire `parentId` into draft save and restore

**Files:**
- Modify: `ui/src/components/NewIssueDialog.tsx:301-328` (save draft effect)
- Modify: `ui/src/components/NewIssueDialog.tsx:331-373` (restore draft effect)

- [ ] **Step 1: Add `parentId` to the draft save effect**

Find the `useEffect` that calls `scheduleSave(...)` (~line 301). Update the object and dependency array:

```typescript
useEffect(() => {
  if (!newIssueOpen) return;
  scheduleSave({
    title,
    description,
    status,
    priority,
    assigneeValue,
    projectId,
    parentId,                    // ← add this
    assigneeModelOverride,
    assigneeThinkingEffort,
    assigneeChrome,
    useIsolatedExecutionWorkspace,
  });
}, [
  title,
  description,
  status,
  priority,
  assigneeValue,
  projectId,
  parentId,                      // ← add this
  assigneeModelOverride,
  assigneeThinkingEffort,
  assigneeChrome,
  useIsolatedExecutionWorkspace,
  newIssueOpen,
  scheduleSave,
]);
```

- [ ] **Step 2: Initialize `parentId` in all three branches of the restore effect**

Find the restore `useEffect` (~line 331). There are three branches (defaults with title, draft exists, no draft). Add `setParentId(...)` to each:

**Branch 1 — defaults with title (`if (newIssueDefaults.title)`):**
```typescript
setProjectId(newIssueDefaults.projectId ?? "");
setParentId(newIssueDefaults.parentId ?? "");   // ← add after setProjectId
```

**Branch 2 — draft exists (`} else if (draft && draft.title.trim()) {`):**
```typescript
setProjectId(newIssueDefaults.projectId ?? draft.projectId);
setParentId(newIssueDefaults.parentId ?? draft.parentId ?? "");  // ← add after setProjectId
```

**Branch 3 — no draft (`} else {`):**
```typescript
setProjectId(newIssueDefaults.projectId ?? "");
setParentId(newIssueDefaults.parentId ?? "");   // ← add after setProjectId
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/NewIssueDialog.tsx
git commit -m "feat(ui): wire parentId into draft save and restore"
```

---

## Chunk 2: Query, UI, and submit

### Task 3: Add issue list query and build parent options

**Files:**
- Modify: `ui/src/components/NewIssueDialog.tsx:207-217` (query block)
- Modify: `ui/src/components/NewIssueDialog.tsx` (useMemo for parentOptions, near other options)

- [ ] **Step 1: Add issues query after the existing `projects` query (~line 213)**

```typescript
const { data: allIssues } = useQuery({
  queryKey: queryKeys.issues.list(effectiveCompanyId!),
  queryFn: () => issuesApi.list(effectiveCompanyId!, {}),
  enabled: !!effectiveCompanyId && newIssueOpen,
});
```

- [ ] **Step 2: Build `parentOptions` with `useMemo` (near other options like `projectOptions`)**

Add after the existing `projectOptions` useMemo:

```typescript
const parentOptions = useMemo<InlineEntityOption[]>(
  () =>
    (allIssues ?? []).map((issue) => ({
      id: issue.id,
      label: `${issue.identifier ?? issue.id.slice(0, 8)} ${issue.title}`,
      searchText: `${issue.identifier ?? issue.id.slice(0, 8)} ${issue.title}`,
    })),
  [allIssues],
);
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/NewIssueDialog.tsx
git commit -m "feat(ui): fetch issues list and build parentOptions for parent picker"
```

---

### Task 4: Add Parent InlineEntitySelector to the toolbar

**Files:**
- Modify: `ui/src/components/NewIssueDialog.tsx:28-43` (imports)
- Modify: `ui/src/components/NewIssueDialog.tsx:843` (after project selector closing tag)

- [ ] **Step 1: No new icon import needed**

The `renderTriggerValue` uses the Unicode character `⤴` (upward arrow with hook) — no additional lucide-react import required.

- [ ] **Step 2: Add the parent selector in the toolbar after the closing `/>` of the Project selector (~line 842)**

The current toolbar ends with:
```tsx
              />   {/* ← end of Project InlineEntitySelector */}
            </div>
          </div>
        </div>
```

Insert the parent selector between the Project `/>` and the closing `</div>`:

```tsx
              />   {/* ← end of Project InlineEntitySelector */}
              <span>under</span>
              <InlineEntitySelector
                value={parentId}
                options={parentOptions}
                placeholder="Parent"
                disablePortal
                noneLabel="No parent"
                searchPlaceholder="Search by title or ID..."
                emptyMessage="No issues found."
                onChange={setParentId}
                renderTriggerValue={(option) =>
                  option ? (
                    <span className="flex items-center gap-1 truncate max-w-[160px]">
                      <span className="shrink-0 text-muted-foreground">⤴</span>
                      <span className="truncate">{option.label}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Parent</span>
                  )
                }
              />
            </div>
```

- [ ] **Step 3: Verify the toolbar renders correctly in the browser**

Run: `cd ui && pnpm dev` (or the existing dev server if already running)

Open the New Issue dialog and confirm:
- The toolbar shows: `For [Assignee] in [Project] under [Parent]`
- Clicking "Parent" opens a searchable dropdown
- Issues are listed and searchable by identifier or title
- Selecting an issue shows `⤴ TOP-42 Fix login bug` in the pill
- Clearing returns to "Parent" placeholder

- [ ] **Step 4: Commit**

```bash
git add ui/src/components/NewIssueDialog.tsx
git commit -m "feat(ui): add parent issue InlineEntitySelector to new issue toolbar"
```

---

### Task 5: Include `parentId` in submit payload

**Files:**
- Modify: `ui/src/components/NewIssueDialog.tsx:454-465` (createIssue.mutate call)

- [ ] **Step 1: Add `parentId` to the `createIssue.mutate(...)` call in `handleSubmit()`**

Find the `createIssue.mutate({...})` call (~line 454). Add `parentId` after `projectId`:

```typescript
createIssue.mutate({
  companyId: effectiveCompanyId,
  title: title.trim(),
  description: description.trim() || undefined,
  status,
  priority: priority || "medium",
  ...(selectedAssigneeAgentId ? { assigneeAgentId: selectedAssigneeAgentId } : {}),
  ...(selectedAssigneeUserId ? { assigneeUserId: selectedAssigneeUserId } : {}),
  ...(projectId ? { projectId } : {}),
  ...(parentId ? { parentId } : {}),       // ← add this
  ...(assigneeAdapterOverrides ? { assigneeAdapterOverrides } : {}),
  ...(executionWorkspaceSettings ? { executionWorkspaceSettings } : {}),
});
```

- [ ] **Step 2: Verify end-to-end in browser**

1. Open New Issue dialog
2. Set a parent issue from the picker (e.g. select `TOP-42`)
3. Submit the issue
4. Navigate to `TOP-42` → Sub-issues tab
5. Confirm the new issue appears as a child

- [ ] **Step 3: Verify `newIssueDefaults.parentId` pre-fills correctly**

In browser console, run:
```js
// Simulate what IssueDetail "Add sub-issue" button would do:
window.__paperclipOpenNewIssue?.({ parentId: '<some-issue-id>' })
```
Or restore the "Add sub-issue" button temporarily to test the pre-fill path.

- [ ] **Step 4: Final commit**

```bash
git add ui/src/components/NewIssueDialog.tsx
git commit -m "feat(ui): include parentId in new issue submit payload"
```

---

## Summary

Changes span two files:

**`ui/src/context/DialogContext.tsx`**

| Area | Lines changed |
|---|---|
| `NewIssueDefaults` interface | +1 field |

**`ui/src/components/NewIssueDialog.tsx`**

| Area | Lines changed |
|---|---|
| `IssueDraft` interface | +1 field |
| State declaration | +1 `useState` |
| `reset()` | +1 line |
| `handleCompanyChange()` | +1 line |
| Draft save `useEffect` | +2 lines (object + dep array) |
| Draft restore `useEffect` | +3 lines (one per branch) |
| Issue list `useQuery` | +5 lines |
| `parentOptions` `useMemo` | +8 lines |
| Toolbar `InlineEntitySelector` | +17 lines |
| `handleSubmit()` payload | +1 line |
