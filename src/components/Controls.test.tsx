import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { expect, test } from "vitest";
import { Controls, type ControlsProps } from "./Controls";
import { DEFAULT_PARAMS, type WorldParams } from "../lib/sim";

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

const renderControls = async (props: Partial<ControlsProps> = {}) =>
  render(
    <Controls
      params={DEFAULT_PARAMS}
      presetId="moderate"
      onChange={noop}
      onPreset={noop}
      onNewWorld={noop}
      onReset={noop}
      {...props}
    />,
  );

const withViewport = async (matches: boolean, run: () => Promise<void>) => {
  const restore = stubViewport(matches);
  try {
    await run();
  } finally {
    restore();
  }
};

test("sections are collapsed on narrow viewports", async () => {
  await withViewport(false, async () => {
    await renderControls();
    const sections = document.querySelectorAll("details");
    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) {
      expect(section.open).toBe(false);
    }
  });
});

test("sections are open on wide viewports", async () => {
  await withViewport(true, async () => {
    await renderControls();
    const sections = document.querySelectorAll("details");
    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) {
      expect(section.open).toBe(true);
    }
  });
});

test("moving a slider reports the patched param", async () => {
  await withViewport(true, async () => {
    const calls: Partial<WorldParams>[] = [];
    const { getByRole } = await renderControls({ onChange: (patch) => calls.push(patch) });
    const population = getByRole("slider", { name: /Population/ });
    await expect.element(population).toBeVisible();

    await userEvent.click(population);
    await userEvent.keyboard("{Home}");
    expect(calls.at(-1)).toEqual({ populationSize: 50 });
  });
});

test("clicking a preset reports its id", async () => {
  await withViewport(true, async () => {
    const ids: string[] = [];
    const { getByRole } = await renderControls({ onPreset: (id) => ids.push(id) });
    await getByRole("button", { name: "Extreme" }).click();
    expect(ids).toContain("extreme");
  });
});

test("shows the blurb for the active preset", async () => {
  await withViewport(true, async () => {
    const { getByText } = await renderControls({ presetId: "high" });
    await expect.element(getByText("Concentrated pay and ownership.")).toBeVisible();
  });
});

test("new world and reset trigger their handlers", async () => {
  await withViewport(true, async () => {
    let newWorlds = 0;
    let resets = 0;
    const { getByRole } = await renderControls({
      onNewWorld: () => newWorlds++,
      onReset: () => resets++,
    });
    await getByRole("button", { name: "New world" }).click();
    await getByRole("button", { name: "Reset" }).click();
    expect(newWorlds).toBe(1);
    expect(resets).toBe(1);
  });
});

test("renders the params it is given", async () => {
  await withViewport(true, async () => {
    const { getByRole } = await renderControls({
      params: { ...DEFAULT_PARAMS, populationSize: 250 },
    });
    const population = getByRole("slider", { name: /Population/ });
    await expect.element(population).toBeVisible();
    expect((population.element() as HTMLInputElement).value).toBe("250");
  });
});
