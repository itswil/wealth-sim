import { useState } from "react";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { expect, test } from "vitest";
import { SERIES, TimeSeriesChart, WealthDistribution } from "./Charts";
import { PALETTE } from "../lib/palette";
import { sortWealth, type YearStats } from "../lib/sim";

const noop = () => {};

const makeStats = (year: number): YearStats => ({
  year,
  total: 5e7,
  mean: 50_000,
  median: 1_000,
  gini: 0.6,
  top1Avg: 1_000_000,
  top10Avg: 200_000,
  bottom50Avg: 100,
  top1Share: 0.4,
  top10Share: 0.7,
  bottom50Share: 0.01,
});

const stats: YearStats[] = Array.from({ length: 301 }, (_, year) => makeStats(year));

const svgTexts = () =>
  Array.from(document.querySelectorAll("text")).map((element) => element.textContent);

const renderChart = async (logScale: boolean) =>
  render(
    <TimeSeriesChart
      stats={stats}
      logScale={logScale}
      selectedYear={0}
      hoverYear={null}
      onHoverYear={noop}
      onSelectYear={noop}
    />,
  );

function ChartHarness() {
  const [hoverYear, setHoverYear] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState(0);
  return (
    <div>
      <span data-testid="hover-status">hover:{hoverYear ?? "none"}</span>
      <span data-testid="selected-status">selected:{selectedYear}</span>
      <TimeSeriesChart
        stats={stats}
        logScale={false}
        selectedYear={selectedYear}
        hoverYear={hoverYear}
        onHoverYear={setHoverYear}
        onSelectYear={(year) => {
          setSelectedYear(year);
          setHoverYear(null);
        }}
      />
    </div>
  );
}

const renderDistribution = async (values: number[]) =>
  render(
    <WealthDistribution sorted={sortWealth(Float64Array.from(values))} mean={25} median={26} />,
  );

test("log scale switches the y-axis to powers of ten", async () => {
  await renderChart(true);
  expect(svgTexts()).toContain("$1K");
});

test("linear scale uses round currency ticks", async () => {
  await renderChart(false);
  expect(svgTexts()).not.toContain("$1K");
});

test("labels every series on the chart", async () => {
  await renderChart(false);
  for (const series of SERIES) {
    expect(svgTexts()).toContain(series.label);
  }
});

test("hovering reports the year under the pointer", async () => {
  const { getByRole, getByTestId } = await render(<ChartHarness />);
  const chart = getByRole("img", { name: /arrow keys/i });
  await expect.element(chart).toBeVisible();

  await userEvent.hover(chart);
  await expect.poll(() => getByTestId("hover-status").element().textContent).not.toBe("hover:none");
});

test("clicking selects a year on the chart", async () => {
  const { getByRole, getByTestId } = await render(<ChartHarness />);
  const chart = getByRole("img", { name: /arrow keys/i });
  await expect.element(chart).toBeVisible();

  await userEvent.click(chart);
  await expect
    .poll(() => getByTestId("selected-status").element().textContent)
    .not.toBe("selected:0");

  const selected = getByTestId("selected-status").element().textContent ?? "";
  const year = Number(selected.split(":")[1]);
  expect(year).toBeGreaterThanOrEqual(0);
  expect(year).toBeLessThanOrEqual(300);
});

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
