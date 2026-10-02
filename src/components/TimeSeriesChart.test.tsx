import { useState } from "react";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { expect, test } from "vitest";
import { SERIES, TimeSeriesChart } from "./TimeSeriesChart";
import type { YearStats } from "../lib/sim";

const noop = () => {};

const makeStats = (year: number): YearStats => ({
  year,
  total: 5e7,
  mean: 50_000,
  median: 1_000,
  gini: 0.6,
  top1Avg: 1_000_000,
  bottom50Avg: 100,
  top1Share: 0.4,
  bottom50Share: 0.01,
  meanIncome: 50_000,
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
  const chart = getByRole("slider", { name: /arrow keys/i });
  await expect.element(chart).toBeVisible();

  await userEvent.hover(chart);
  await expect.poll(() => getByTestId("hover-status").element().textContent).not.toBe("hover:none");
});

test("clicking selects a year on the chart", async () => {
  const { getByRole, getByTestId } = await render(<ChartHarness />);
  const chart = getByRole("slider", { name: /arrow keys/i });
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

test("exposes itself as a slider with the active year as its value", async () => {
  const { getByRole } = await render(
    <TimeSeriesChart
      stats={stats}
      logScale={false}
      selectedYear={120}
      hoverYear={null}
      onHoverYear={noop}
      onSelectYear={noop}
    />,
  );
  const chart = getByRole("slider", { name: /arrow keys/i });
  await expect.element(chart).toBeVisible();
  expect(chart.element().getAttribute("aria-valuenow")).toBe("120");
  expect(chart.element().getAttribute("aria-valuemax")).toBe("300");
});

test("renders an empty state instead of crashing without any years", async () => {
  const { getByText } = await render(
    <TimeSeriesChart
      stats={[]}
      logScale={false}
      selectedYear={0}
      hoverYear={null}
      onHoverYear={noop}
      onSelectYear={noop}
    />,
  );
  await expect.element(getByText(/no years to chart/i)).toBeVisible();
});
