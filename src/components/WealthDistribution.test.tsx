import { render } from "vitest-browser-react";
import { expect, test } from "vitest";
import { WealthDistribution } from "./WealthDistribution";
import { PALETTE } from "../lib/palette";
import { sortWealth } from "../lib/sim";

const svgTexts = () =>
  Array.from(document.querySelectorAll("text")).map((element) => element.textContent);

const renderDistribution = async (values: number[]) =>
  render(
    <WealthDistribution sorted={sortWealth(Float64Array.from(values))} mean={25} median={26} />,
  );

test("highlights the top-1% bins for a 50-person world", async () => {
  await renderDistribution(Array.from({ length: 50 }, (_, i) => i + 1));
  const red = document.querySelectorAll(`rect[fill="${PALETTE.vermillion}"]`);
  const blue = document.querySelectorAll(`rect[fill="${PALETTE.blue}"]`);
  expect(red.length).toBeGreaterThan(0);
  expect(blue.length).toBeGreaterThan(0);
});

test("shows the empty state when everyone is in debt", async () => {
  const { getByText } = await renderDistribution([-5, -1, 0]);
  await expect.element(getByText(/no positive wealth/)).toBeVisible();
});

test("counts people in debt", async () => {
  await renderDistribution([-5, -1, 10, 20, 30]);
  expect(svgTexts().some((text) => text?.endsWith(" in debt"))).toBe(true);
});
