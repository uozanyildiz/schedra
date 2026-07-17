import type {
  ConflictVisibility,
  KarstView,
  SelectionChange,
} from "@karst/core";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  colorAt,
  DAY,
  HOUR,
  makeWorkstreams,
  SCHEDULE_START,
  seeded,
  type WorkItem,
} from "./data";
import { Icon } from "./icons";
import { KarstSurface } from "./karst-surface";

const RANGE = {
  start: SCHEDULE_START - DAY,
  end: SCHEDULE_START + 2 * DAY,
};

const VIEW_LABELS: Record<KarstView, string> = {
  hour: "Hour",
  day: "Day",
  week: "Week",
};

export default function App() {
  const [rows, setRows] = useState(() => makeWorkstreams());
  const [view, setView] = useState<KarstView>("hour");
  const [zoom, setZoom] = useState(1);
  const [selection, setSelection] = useState<SelectionChange>({
    selectedItemIds: ["ROW-0008-04"],
    activeItemId: "ROW-0008-04",
  });
  const [activeItem, setActiveItem] = useState<WorkItem | null>(null);
  const [conflictVisibility, setConflictVisibility] =
    useState<ConflictVisibility>("show");
  const [conflictCount, setConflictCount] = useState(0);
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<number | undefined>(undefined);

  const totalItems = useMemo(
    () => rows.reduce((total, row) => total + row.items.length, 0),
    [rows],
  );

  const announce = useCallback((message: string) => {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 1_800);
  }, []);

  const addItem = () => {
    const sequence = Math.floor(performance.now());
    const offset = Math.floor(seeded(sequence, 1) * 92) * 15 * 60_000;
    const duration = Math.min(
      30 * 60_000 + seeded(sequence, 2) * 90 * 60_000,
      DAY - offset,
    );
    const item: WorkItem = {
      id: `NEW-${String(sequence).slice(-6)}`,
      start: SCHEDULE_START + offset,
      end: SCHEDULE_START + offset + duration,
      data: { color: colorAt(sequence), progress: 0, label: "NEW · 0%" },
    };
    setRows((current) =>
      current.map((row, index) =>
        index === 0 ? { ...row, items: [...row.items, item] } : row,
      ),
    );
    setSelection({ selectedItemIds: [item.id], activeItemId: item.id });
    announce(`${item.id} added to the first row.`);
  };

  const addBatch = () => {
    const batchSeed = Math.floor(performance.now());
    setRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex >= 25) return row;
        const additions: WorkItem[] = Array.from({ length: 10 }, (_, index) => {
          const seed = batchSeed + rowIndex * 10 + index;
          const offset = Math.floor(seeded(seed, 1) * 92) * 15 * 60_000;
          return {
            id: `BAT-${batchSeed}-${rowIndex}-${index}`,
            start: SCHEDULE_START + offset,
            end:
              SCHEDULE_START +
              offset +
              Math.min(15 * 60_000 + seeded(seed, 2) * HOUR, DAY - offset),
            data: {
              color: colorAt(rowIndex + index),
              progress: 0,
              label: "BATCH · 0%",
            },
          };
        });
        return { ...row, items: [...row.items, ...additions] };
      }),
    );
    announce("250 items added across 25 rows.");
  };

  const removeSelected = () => {
    const ids = new Set(selection.selectedItemIds);
    if (!ids.size) return;
    setRows((current) =>
      current.map((row) => ({
        ...row,
        items: row.items.filter((item) => !ids.has(item.id)),
      })),
    );
    announce(
      `${ids.size} selected ${ids.size === 1 ? "item" : "items"} removed.`,
    );
    setSelection({ selectedItemIds: [], activeItemId: null });
  };

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Icon name="layers" size={18} />
          </div>
          <div>
            <span>KARST / PLANNING LAB</span>
            <strong>Canvas timeline</strong>
          </div>
        </div>

        <div className="status-strip">
          <span>
            <i /> LIVE MODEL
          </span>
          <b>{totalItems.toLocaleString()}</b>
          <small>scheduled items</small>
        </div>

        <div className="actions">
          <button className="button secondary" type="button" onClick={addBatch}>
            <Icon name="plus" /> Add 250
          </button>
          <button className="button primary" type="button" onClick={addItem}>
            <Icon name="plus" /> New item
          </button>
        </div>
      </header>

      <section className="workspace">
        <div className="workspace-toolbar">
          <div className="workspace-title">
            <span className="index">01</span>
            <div>
              <strong>Launch portfolio</strong>
              <small>CONTINUOUS TIMELINE · EUROPE / ISTANBUL</small>
            </div>
          </div>

          <div className="center-controls">
            <div className="segmented">
              {(Object.keys(VIEW_LABELS) as KarstView[]).map((option) => (
                <button
                  type="button"
                  className={view === option ? "active" : ""}
                  onClick={() => setView(option)}
                  key={option}
                >
                  {VIEW_LABELS[option]}
                </button>
              ))}
            </div>
            <div className="zoom-control">
              <button
                type="button"
                onClick={() => setZoom((value) => Math.max(0.5, value - 0.2))}
              >
                <Icon name="minus" />
              </button>
              <input
                type="range"
                min=".5"
                max="2.5"
                step=".1"
                value={zoom}
                onChange={(event) => setZoom(Number(event.currentTarget.value))}
              />
              <button
                type="button"
                onClick={() => setZoom((value) => Math.min(2.5, value + 0.2))}
              >
                <Icon name="plus" />
              </button>
              <span>{Math.round(zoom * 100)}%</span>
            </div>
          </div>

          <div className="selection-tools">
            <button
              type="button"
              className={`conflict-toggle ${conflictVisibility === "hide-later" ? "active" : ""}`}
              onClick={() =>
                setConflictVisibility((current) =>
                  current === "show" ? "hide-later" : "show",
                )
              }
            >
              <Icon name="warning" size={14} />
              {conflictCount} conflicts ·{" "}
              {conflictVisibility === "show" ? "show" : "hide later"}
            </button>
            {activeItem ? (
              <button
                className="icon-button danger"
                type="button"
                onClick={removeSelected}
                title={`Remove ${selection.selectedItemIds.length} selected items`}
              >
                <Icon name="trash" />
              </button>
            ) : null}
          </div>
        </div>

        <KarstSurface
          rows={rows}
          range={RANGE}
          view={view}
          zoom={zoom}
          selectedItemIds={selection.selectedItemIds}
          activeItemId={selection.activeItemId}
          conflictVisibility={conflictVisibility}
          onSelectionChange={setSelection}
          onConflictCountChange={setConflictCount}
          onActiveItemChange={setActiveItem}
        />
      </section>

      <footer>
        <span>LAYERED CANVAS 2D</span>
        <span>VIRTUAL ROWS</span>
        <span>CONTROLLED SELECTION</span>
        <span className="footer-note">
          <Icon name="target" /> Click a bar. Hold Shift or Cmd/Ctrl for
          multiple.
        </span>
      </footer>

      <div className={`toast ${notice ? "visible" : ""}`}>{notice}</div>
    </main>
  );
}
