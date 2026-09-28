import { render } from "vitest-browser-react";
import { expect, test } from "vitest";
import { Controls } from "./Controls";
import { DEFAULT_PARAMS } from "../lib/sim";

const noop = () => {};

const stubViewport = (matches: boolean): (() => void) => {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
};

const renderControls = async () =>
  render(
    <Controls
      params={DEFAULT_PARAMS}
      presetId="moderate"
      onChange={noop}
      onPreset={noop}
      onNewWorld={noop}
      onReset={noop}
    />,
  );

test("sections are collapsed on narrow viewports", async () => {
  const restore = stubViewport(false);
  try {
    await renderControls();
    const sections = document.querySelectorAll("details");
    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) {
      expect(section.open).toBe(false);
    }
  } finally {
    restore();
  }
});

test("sections are open on wide viewports", async () => {
  const restore = stubViewport(true);
  try {
    await renderControls();
    const sections = document.querySelectorAll("details");
    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) {
      expect(section.open).toBe(true);
    }
  } finally {
    restore();
  }
});
