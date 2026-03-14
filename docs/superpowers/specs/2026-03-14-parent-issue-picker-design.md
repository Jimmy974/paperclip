# Parent Issue Picker in New Issue Dialog

**Date:** 2026-03-14
**Status:** Approved

## Summary

Add a "Parent issue" pill to the bottom toolbar of `NewIssueDialog`, allowing users to link a newly created issue to any existing issue as a sub-issue at creation time. Matches the existing pattern of Project and Goal inline selectors.

## Requirements

- Parent picker appears in the bottom toolbar alongside Status, Priority, Assignee, Project
- Search by identifier + title (e.g. `TOP-42` or `Fix login bug`)
- No project auto-inheritance — project selection remains independent
- Pill displays identifier + truncated title when selected (e.g. `⤴ TOP-42 Fix login bug`)
- `parentId` initializes from `newIssueDefaults.parentId` so the IssueDetail "Add sub-issue" flow can pre-fill it
- `parentId` included in create payload when set
- `parentId` saved and restored via draft mechanism

## Design

### State

Add `parentId: string` to `NewIssueDialog` state, initialized from `newIssueDefaults.parentId ?? ""`.

Add `parentId` to the `IssueDraft` interface so it persists in localStorage draft.

### Data

Fetch company issues with the existing `issuesApi.list(companyId, {})` call inside `NewIssueDialog`. Map to `InlineEntityOption[]`:

```ts
{
  id: issue.id,
  label: `${issue.identifier ?? issue.id.slice(0, 8)} ${issue.title}`,
  searchText: `${issue.identifier ?? ""} ${issue.title}`,
}
```

`InlineEntitySelector` handles client-side filtering — same approach as projects.

### Component

Add `InlineEntitySelector` to the toolbar row:

- `placeholder`: `"Parent"`
- `noneLabel`: `"No parent"`
- `searchPlaceholder`: `"Search by title or ID…"`
- `emptyMessage`: `"No issues found"`
- `renderTriggerValue`: render `⤴ {identifier} {title truncated to ~30 chars}` when selected
- `disablePortal`: `true` (same as other selectors in the dialog)

### Submit Payload

```ts
...(parentId ? { parentId } : {})
```

Included in the `issuesApi.create()` call body.

### Draft

Add `parentId` to `IssueDraft` interface. Save on change (same debounce pattern). Restore on open with `newIssueDefaults.parentId ?? draft.parentId ?? ""`.

## Files Changed

| File | Change |
|---|---|
| `ui/src/components/NewIssueDialog.tsx` | All changes — state, query, selector, payload, draft |

`ui/src/context/DialogContext.tsx` — no change (already has `parentId?: string` in `NewIssueDefaults`).

## Out of Scope

- Restoring the "Add sub-issue" button on `IssueDetail` (separate task)
- Server-side search/filtering of parent issues
- Restricting parent candidates by status or project
