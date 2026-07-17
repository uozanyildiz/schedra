# Conflicts and validation

Karst separates overlap conflicts from invalid data.

- A conflict is valid data that overlaps another item.
- A data issue is malformed input that cannot be rendered safely.

Neither category crashes the full timeline.

## Conflict rules

Item intervals are half-open:

```text
[start, end)
```

These items do not conflict:

```text
Item A: 09:00–10:00
Item B: 10:00–11:00
```

These items conflict:

```text
Item A: 09:00–10:01
Item B: 10:00–11:00
```

Milestones where `start === end` do not create conflicts.

## Show every conflict

```tsx
const karst = useKarst({
  // Other options...
  conflictVisibility: "show",
  onConflictsChange(conflicts) {
    setConflicts(conflicts);
  },
});
```

All items stay visible. Custom rendering receives `state.conflicted`.

## Hide later items

```tsx
const karst = useKarst({
  // Other options...
  conflictVisibility: "hide-later",
  onConflictsChange: setConflicts,
});
```

The earliest item remains visible. Later overlapping items are hidden from the
canvas but remain in your data and conflict list.

If two items start at the same time, the one appearing first in the row's
`items` array wins.

## Conflict result

```ts
interface KarstConflict {
  rowId: string;
  earlierItemId: string;
  laterItemId: string;
  overlapStart: number;
  overlapEnd: number;
}
```

Example UI:

```tsx
{
  conflicts.length > 0 ? (
    <button onClick={() => setConflictPanelOpen(true)}>
      {conflicts.length} schedule conflicts
    </button>
  ) : null;
}
```

## Invalid data

Karst reports:

- Duplicate row IDs
- Duplicate item IDs
- Non-finite start timestamps
- Non-finite end timestamps
- End timestamps earlier than start

```tsx
const karst = useKarst({
  // Other options...
  onDataIssues(issues) {
    for (const issue of issues) {
      console.warn(issue.code, issue.rowId, issue.itemId, issue.message);
    }
  },
});
```

Invalid rows or items are skipped. Valid content continues rendering.

## Validate outside React

`@karst/core` exports `validateRows`:

```ts
import { validateRows } from "@karst/core";

const result = validateRows(rows);

console.log(result.rows);
console.log(result.issues);
```

This is useful before saving or importing schedule data.

## Detect conflicts outside React

```ts
import { detectConflicts } from "@karst/core";

const result = detectConflicts(rows, "hide-later");

console.log(result.conflicts);
console.log(result.conflictedItemIds);
console.log(result.hiddenItemIds);
```
