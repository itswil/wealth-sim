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

/** An entirely net-indebted population: no value is positive, so log is impossible. */
const debtStats: YearStats[] = Array.from({ length: 301 }, (_, year) => ({
  ...makeStats(year),
  mean: -200_000,
  median: -250_000,
  top1Avg: -50_000,
  bottom50Avg: -300_000,
}));

/** Everything stays positive except the bottom half, which carries debt. */
const mixedDebtStats: YearStats[] = Array.from({ length: 301 }, (_, year) => ({
  ...makeStats(year),
  bottom50Avg: -300_000,
}));

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

test("log scale falls back to real ticks for an all-negative population", async () => {
  // Regression: with no positive values, log10 clamped every series onto one
  // line and the only tick was "$1". The axis now degrades to linear, so the
  // negative values get genuine tick labels.
  await render(
    <TimeSeriesChart
      stats={debtStats}
      logScale
      selectedYear={0}
      hoverYear={null}
      onHoverYear={noop}
      onSelectYear={noop}
    />,
  );
  const texts = svgTexts();
  expect(texts.some((t) => t?.startsWith("-$"))).toBe(true);
  expect(texts).not.toContain("$1K");
  expect(texts).not.toContain("$1");
});

test("says when the log axis degrades to linear", async () => {
  const { getByText } = await render(
    <TimeSeriesChart
      stats={debtStats}
      logScale
      selectedYear={0}
      hoverYear={null}
      onHoverYear={noop}
      onSelectYear={noop}
    />,
  );
  await expect.element(getByText(/showing a linear axis instead/)).toBeVisible();
});

test("log scale reserves a labelled strip for a series in debt", async () => {
  const { getByText } = await render(
    <TimeSeriesChart
      stats={mixedDebtStats}
      logScale
      selectedYear={0}
      hoverYear={null}
      onHoverYear={noop}
      onSelectYear={noop}
    />,
  );
  // Debt lands in its own strip instead of being pinned to the log floor...
  await expect.element(getByText("in debt")).toBeVisible();
  // ...while the axis above it stays logarithmic and un-degraded.
  expect(svgTexts()).toContain("$1K");
  expect(document.body.textContent).not.toContain("showing a linear axis");
});

test("linear scale draws debt natively, without a strip", async () => {
  await render(
    <TimeSeriesChart
      stats={mixedDebtStats}
      logScale={false}
      selectedYear={0}
      hoverYear={null}
      onHoverYear={noop}
      onSelectYear={noop}
    />,
  );
  expect(svgTexts()).not.toContain("in debt");
  expect(document.body.textContent).not.toContain("showing a linear axis");
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

test("a single-year series renders a valid progress bar", async () => {
  // Regression: `selectedYear / maxYear` divided by zero when maxYear was 0,
  // emitting width="NaN" on the progress bar.
  const { getByRole } = await render(
    <TimeSeriesChart
      stats={[makeStats(0)]}
      logScale={false}
      selectedYear={0}
      hoverYear={null}
      onHoverYear={noop}
      onSelectYear={noop}
    />,
  );
  const chart = getByRole("slider", { name: /arrow keys/i });
  await expect.element(chart).toBeVisible();

  const bars = Array.from(document.querySelectorAll("rect")).filter(
    (r) => r.getAttribute("fill") === "#0284C7",
  );
  expect(bars.length).toBeGreaterThan(0);
  for (const bar of bars) {
    expect(bar.getAttribute("width")).not.toBe("NaN");
    expect(Number.isFinite(Number(bar.getAttribute("width")))).toBe(true);
  }
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

function YearsHarness() {
  const [loaded, setLoaded] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setLoaded(true)}>
        load years
      </button>
      <TimeSeriesChart
        stats={loaded ? stats : []}
        logScale={false}
        selectedYear={0}
        hoverYear={null}
        onHoverYear={noop}
        onSelectYear={noop}
      />
    </div>
  );
}

test("recovers when years arrive after an empty render", async () => {
  // Regression: `useEffect` was declared after the empty-state early return,
  // so the first render skipped a hook the next one called and React threw
  // "Rendered more hooks than during the previous render."
  const screen = await render(<YearsHarness />);
  await expect.element(screen.getByText(/no years to chart/i)).toBeVisible();

  await screen.getByRole("button", { name: "load years" }).click();
  await expect.element(screen.getByRole("slider", { name: /arrow keys/i })).toBeVisible();
});
