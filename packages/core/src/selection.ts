import type { KarstSelection, SelectionChange } from "./types.js";

export function proposeSelection(
  selection: KarstSelection,
  itemId: string,
  additive = false,
): SelectionChange {
  if (!additive) return { selectedItemIds: [itemId], activeItemId: itemId };
  const ids = new Set(selection.selectedItemIds);
  if (ids.has(itemId)) {
    ids.delete(itemId);
    return {
      selectedItemIds: [...ids],
      activeItemId:
        selection.activeItemId === itemId
          ? ([...ids].at(-1) ?? null)
          : selection.activeItemId,
    };
  }
  ids.add(itemId);
  return { selectedItemIds: [...ids], activeItemId: itemId };
}

export function cleanSelection(
  selection: KarstSelection,
  existingItemIds: ReadonlySet<string>,
): SelectionChange {
  const selectedItemIds = selection.selectedItemIds.filter((id) =>
    existingItemIds.has(id),
  );
  return {
    selectedItemIds,
    activeItemId:
      selection.activeItemId && existingItemIds.has(selection.activeItemId)
        ? selection.activeItemId
        : (selectedItemIds.at(-1) ?? null),
  };
}
