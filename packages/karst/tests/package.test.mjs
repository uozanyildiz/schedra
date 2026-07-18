import assert from "node:assert/strict";
import test from "node:test";

test("core subpath exports the engine", async () => {
  const core = await import("../dist/core/index.js");
  assert.equal(typeof core.createKarstEngine, "function");
});

test("react subpath exports the timeline", async () => {
  const react = await import("../dist/react/index.js");
  assert.equal(typeof react.KarstTimeline, "function");
});

test("react-popover subpath exports the hook", async () => {
  const popover = await import("../dist/react-popover/index.js");
  assert.equal(typeof popover.useKarstPopover, "function");
});
