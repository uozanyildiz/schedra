import type { DataIssue, KarstItem, KarstRow, ValidatedData } from "./types.js";

export function validateRows<TRowData, TItemData>(
  rows: readonly KarstRow<TRowData, TItemData>[],
): ValidatedData<TRowData, TItemData> {
  const issues: DataIssue[] = [];
  const rowIds = new Set<string>();
  const itemIds = new Set<string>();
  const validRows: KarstRow<TRowData, TItemData>[] = [];

  for (const row of rows) {
    if (rowIds.has(row.id)) {
      issues.push(
        issue("DUPLICATE_ROW_ID", `Duplicate row ID "${row.id}".`, row.id),
      );
      continue;
    }
    rowIds.add(row.id);
    const items: KarstItem<TItemData>[] = [];
    for (const item of row.items) {
      if (itemIds.has(item.id)) {
        issues.push(
          issue(
            "DUPLICATE_ITEM_ID",
            `Duplicate item ID "${item.id}".`,
            row.id,
            item.id,
          ),
        );
        continue;
      }
      itemIds.add(item.id);
      if (!Number.isFinite(item.start)) {
        issues.push(
          issue(
            "INVALID_ITEM_START",
            "Item start must be finite.",
            row.id,
            item.id,
          ),
        );
        continue;
      }
      if (!Number.isFinite(item.end)) {
        issues.push(
          issue(
            "INVALID_ITEM_END",
            "Item end must be finite.",
            row.id,
            item.id,
          ),
        );
        continue;
      }
      if (item.end < item.start) {
        issues.push(
          issue(
            "INVALID_TIME_RANGE",
            "Item end must be greater than or equal to start.",
            row.id,
            item.id,
          ),
        );
        continue;
      }
      items.push(item);
    }
    validRows.push({ ...row, items });
  }
  return { rows: validRows, issues };
}

function issue(
  code: DataIssue["code"],
  message: string,
  rowId?: string,
  itemId?: string,
): DataIssue {
  return {
    code,
    message,
    ...(rowId === undefined ? {} : { rowId }),
    ...(itemId === undefined ? {} : { itemId }),
  };
}
