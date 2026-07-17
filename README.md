# Karst

Karst is a headless, canvas-based Gantt timeline engine for large React schedules.

## Workspace

- `@karst/core` — framework-independent engine, indexes, validation, conflicts, virtualization, and rendering.
- `@karst/react` — controlled React adapter and virtualized timeline components.
- `@karst/react-popover` — optional Floating UI integration for one shared popover.
- `@karst/demo` — reference application and performance playground.

## Version-one constraints

- Immutable, application-owned row data.
- Globally unique row and item IDs.
- Fixed row height.
- Millisecond timestamps.
- Controlled view, zoom, selection, and active item.
- Hour, day, and week views with continuous time scrolling.
- Conflict visibility modes: `show` and `hide-later`.
- Desktop pointer input. Dragging, dependencies, gaps, accessibility, touch optimization, and lazy loading are deferred.
