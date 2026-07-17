import type {
  ConflictResult,
  ConflictVisibility,
  KarstConflict,
  KarstRow,
} from "./types.js";

export function detectConflicts(
  rows: readonly KarstRow[],
  visibility: ConflictVisibility = "show",
): ConflictResult {
  const conflicts: KarstConflict[] = [];
  const conflictedItemIds = new Set<string>();
  const hiddenItemIds = new Set<string>();

  for (const row of rows) {
    const sorted = row.items
      .map((item, inputOrder) => ({ item, inputOrder }))
      .filter(({ item }) => item.end > item.start)
      .sort(
        (a, b) => a.item.start - b.item.start || a.inputOrder - b.inputOrder,
      );

    const active: typeof sorted = [];
    const visibleWinners: typeof sorted = [];
    for (const current of sorted) {
      while (active.length && active[0]!.item.end <= current.item.start)
        active.shift();
      for (const earlier of active) {
        const conflict: KarstConflict = {
          rowId: row.id,
          earlierItemId: earlier.item.id,
          laterItemId: current.item.id,
          overlapStart: current.item.start,
          overlapEnd: Math.min(earlier.item.end, current.item.end),
        };
        conflicts.push(conflict);
        conflictedItemIds.add(earlier.item.id);
        conflictedItemIds.add(current.item.id);
      }
      active.push(current);
      active.sort((a, b) => a.item.end - b.item.end);
      while (
        visibleWinners.length &&
        visibleWinners[0]!.item.end <= current.item.start
      ) {
        visibleWinners.shift();
      }

      if (
        visibility === "hide-later" &&
        visibleWinners.some(({ item }) => item.end > current.item.start)
      ) {
        hiddenItemIds.add(current.item.id);
      } else {
        visibleWinners.push(current);
        visibleWinners.sort((a, b) => a.item.end - b.item.end);
      }
    }
  }
  return { conflicts, conflictedItemIds, hiddenItemIds };
}
