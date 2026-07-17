import type { KarstView, SelectionChange, TimeRange } from "@karst/core";
import { KarstViewport, useKarst } from "@karst/react";
import { useKarstPopover } from "@karst/react-popover";
import { useEffect, useMemo, useRef } from "react";
import type { WorkItem, Workstream } from "./data";
import { ROW_HEIGHT, SCHEDULE_START } from "./data";

interface KarstSurfaceProps {
  rows: readonly Workstream[];
  range: TimeRange;
  view: KarstView;
  zoom: number;
  selectedItemIds: readonly string[];
  activeItemId: string | null;
  conflictVisibility: "show" | "hide-later";
  onSelectionChange: (selection: SelectionChange) => void;
  onConflictCountChange: (count: number) => void;
  onActiveItemChange: (item: WorkItem | null) => void;
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(timestamp);
}

function formatDuration(start: number, end: number) {
  const minutes = Math.round((end - start) / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function KarstSurface({
  rows,
  range,
  view,
  zoom,
  selectedItemIds,
  activeItemId,
  conflictVisibility,
  onSelectionChange,
  onConflictCountChange,
  onActiveItemChange,
}: KarstSurfaceProps) {
  const didPosition = useRef(false);
  const activeEntry = useMemo(() => {
    for (const row of rows) {
      const item = row.items.find((candidate) => candidate.id === activeItemId);
      if (item) return { row, item };
    }
    return null;
  }, [activeItemId, rows]);

  const karst = useKarst({
    rows,
    range,
    view,
    zoom,
    rowHeight: ROW_HEIGHT,
    overscan: 8,
    timeZone: "Europe/Istanbul",
    weekStartsOn: 1,
    conflictVisibility,
    selectedItemIds,
    activeItemId,
    onSelectionChange,
    onConflictsChange: (conflicts) => onConflictCountChange(conflicts.length),
    onDataIssues: (issues) => {
      if (issues.length) console.warn("Karst demo data issues", issues);
    },
    renderItem: ({ context, item, rect, state, theme }) => {
      const data = item.data as WorkItem["data"];
      context.save();
      context.beginPath();
      context.roundRect(
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        theme.itemRadius,
      );
      context.fillStyle = state.active
        ? "#211f1a"
        : state.conflicted
          ? theme.conflictColor
          : data.color;
      context.fill();
      if (data.progress > 0 && !state.active && rect.width > 5) {
        context.save();
        context.clip();
        context.fillStyle = "rgba(0,0,0,.2)";
        context.fillRect(
          rect.x,
          rect.y + rect.height - 5,
          rect.width * (data.progress / 100),
          5,
        );
        context.restore();
      }
      if (rect.width > 70) {
        context.clip();
        context.fillStyle = "#fffdf7";
        context.font = "11px 'DM Mono', monospace";
        context.textBaseline = "middle";
        context.fillText(data.label, rect.x + 7, rect.y + rect.height / 2);
      }
      context.restore();
    },
  });

  const popover = useKarstPopover({
    karst,
    activeItemId,
    open: Boolean(activeEntry),
    onOpenChange: (open) => {
      if (!open)
        onSelectionChange({
          selectedItemIds: [...selectedItemIds],
          activeItemId: null,
        });
    },
  });

  useEffect(() => {
    onActiveItemChange(activeEntry?.item ?? null);
  }, [activeEntry, onActiveItemChange]);

  useEffect(() => {
    if (didPosition.current) return;
    didPosition.current = true;
    karst.scrollToTime(SCHEDULE_START);
  }, [karst]);

  return (
    <div className="gantt-shell">
      <KarstViewport
        karst={karst}
        className="karst-viewport"
        labelWidth={292}
        renderRowLabel={({ row }) => (
          <div className="task-row">
            <span className="team-dot" style={{ background: row.data.color }} />
            <span className="task-copy">
              <strong>{row.data.name}</strong>
              <small>
                {row.id} · {row.data.team}
              </small>
            </span>
            <span className="progress-number">{row.items.length}</span>
          </div>
        )}
      />

      {activeEntry && popover.open ? (
        <aside
          ref={popover.floatingRef}
          style={popover.floatingStyles}
          className="item-popover"
        >
          <div className="popover-heading">
            <span style={{ background: activeEntry.item.data.color }} />
            <div>
              <small>
                {activeEntry.row.id} · {selectedItemIds.length} SELECTED
              </small>
              <strong>{activeEntry.item.id}</strong>
            </div>
            <button
              type="button"
              onClick={() =>
                onSelectionChange({
                  selectedItemIds: [...selectedItemIds],
                  activeItemId: null,
                })
              }
            >
              ×
            </button>
          </div>
          <div className="popover-time">
            <div>
              <small>START</small>
              <strong>{formatTime(activeEntry.item.start)}</strong>
            </div>
            <span>→</span>
            <div>
              <small>END</small>
              <strong>{formatTime(activeEntry.item.end)}</strong>
            </div>
          </div>
          <dl>
            <div>
              <dt>Duration</dt>
              <dd>
                {formatDuration(activeEntry.item.start, activeEntry.item.end)}
              </dd>
            </div>
            <div>
              <dt>Workstream</dt>
              <dd>{activeEntry.row.data.name}</dd>
            </div>
            <div>
              <dt>Progress</dt>
              <dd>{activeEntry.item.data.progress}%</dd>
            </div>
          </dl>
        </aside>
      ) : null}
    </div>
  );
}
