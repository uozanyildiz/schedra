import type { SchedraItem, SchedraRow } from "schedra/core";

export const ROW_COUNT = 1_000;
export const ROW_HEIGHT = 42;
export const SCHEDULE_START = new Date(2026, 6, 17).getTime();
export const HOUR = 60 * 60 * 1_000;
export const DAY = 24 * HOUR;

const COLORS = ["#ff5c35", "#2d6cdf", "#0c9b78", "#9b6bce", "#d99b16"];
const TEAMS = ["Orbit", "Foundry", "Relay", "Signal", "Atlas"];
const VERBS = [
  "Map",
  "Review",
  "Design",
  "Build",
  "Test",
  "Ship",
  "Tune",
  "Verify",
];
const NOUNS = [
  "access flow",
  "billing rules",
  "search index",
  "mobile shell",
  "event pipeline",
  "reports",
  "onboarding",
  "release",
];

export interface WorkstreamData {
  name: string;
  team: string;
  color: string;
}

export interface WorkItemData {
  color: string;
  progress: number;
  label: string;
}

export type WorkItem = SchedraItem<WorkItemData>;
export type Workstream = SchedraRow<WorkstreamData, WorkItemData>;

export function seeded(index: number, salt = 0) {
  const value = Math.sin(index * 9301 + salt * 49297) * 49297;
  return value - Math.floor(value);
}

export function makeItem(
  rowId: string,
  rowIndex: number,
  itemIndex: number,
  prefix = rowId,
): WorkItem {
  const itemCount = 10 + Math.floor(seeded(rowIndex, 4) * 11);
  const seed = rowIndex * 31 + itemIndex;
  const slotWidth = DAY / itemCount;
  const offset = Math.min(
    DAY - 15 * 60_000,
    itemIndex * slotWidth + seeded(seed, 1) * slotWidth * 0.45,
  );
  const duration = Math.min(
    15 * 60_000 + seeded(seed, 2) * Math.min(69 * 60_000, slotWidth * 0.72),
    DAY - offset,
  );
  const progress = Math.round(seeded(seed, 3) * 10) * 10;

  return {
    id: `${prefix}-${String(itemIndex + 1).padStart(2, "0")}`,
    start: SCHEDULE_START + offset,
    end: SCHEDULE_START + offset + duration,
    data: {
      color: COLORS[(rowIndex + itemIndex) % COLORS.length]!,
      progress,
      label: `${String(itemIndex + 1).padStart(2, "0")} · ${progress}%`,
    },
  };
}

export function makeWorkstream(index: number): Workstream {
  const id = `ROW-${String(index + 1).padStart(4, "0")}`;
  const teamIndex = index % TEAMS.length;
  const itemCount = 10 + Math.floor(seeded(index, 4) * 11);

  return {
    id,
    data: {
      name: `${VERBS[index % VERBS.length]!} ${NOUNS[Math.floor(index / 3) % NOUNS.length]!}`,
      team: TEAMS[teamIndex]!,
      color: COLORS[teamIndex]!,
    },
    items: Array.from({ length: itemCount }, (_, itemIndex) =>
      makeItem(id, index, itemIndex),
    ),
  };
}

export function makeWorkstreams(count = ROW_COUNT): Workstream[] {
  return Array.from({ length: count }, (_, index) => makeWorkstream(index));
}

export function colorAt(index: number) {
  return COLORS[index % COLORS.length]!;
}
