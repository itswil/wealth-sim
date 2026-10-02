import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { expect, test } from "vitest";
import App from "./App.jsx";

test("renders the title", async () => {
  const { getByText } = await render(<App />);

  await expect.element(getByText("Wealth Simulator")).toBeVisible();
});

test("shows the wealth-to-income ratio alongside nominal wealth", async () => {
  const { getByText } = await render(<App />);
  await expect.element(getByText("Wealth ÷ income")).toBeVisible();
  await expect.element(getByText("mean net worth in years of income")).toBeVisible();
});

test("play button toggles between play and pause", async () => {
  const { getByRole } = await render(<App />);
  const play = getByRole("button", { name: "Play animation" });
  await expect.element(play).toBeVisible();

  await play.click();
  await expect.element(getByRole("button", { name: "Pause animation" })).toBeVisible();

  await getByRole("button", { name: "Pause animation" }).click();
  await expect.element(getByRole("button", { name: "Play animation" })).toBeVisible();
});

test("chart keyboard navigation jumps to the last year", async () => {
  const { getByRole } = await render(<App />);
  const chart = getByRole("slider", { name: /arrow keys/i });
  await expect.element(chart).toBeVisible();

  await userEvent.click(chart);
  await userEvent.keyboard("{End}");

  const yearInput = getByRole("slider", { name: "Selected year" });
  expect((yearInput.element() as HTMLInputElement).value).toBe("300");

  await userEvent.keyboard("{Home}");
  expect((yearInput.element() as HTMLInputElement).value).toBe("0");
});

test("reset restores default parameters", async () => {
  const { getByRole } = await render(<App />);
  const worldHeading = getByRole("heading", { name: "World" });
  const section = worldHeading.element().closest("details");
  if (section && !section.open) {
    await worldHeading.click();
  }
  const population = getByRole("slider", { name: /Population/ });
  await expect.element(population).toBeVisible();

  await userEvent.click(population);
  await userEvent.keyboard("{Home}");
  expect((population.element() as HTMLInputElement).value).toBe("50");

  await getByRole("button", { name: "Reset" }).click();
  expect((population.element() as HTMLInputElement).value).toBe("1000");
});

test("restores a world from a seed-and-year-only link", async () => {
  // Regression: a link carrying just `seed` and `year` used to be discarded
  // wholesale, silently reverting to the default seed.
  window.history.replaceState(null, "", "/?seed=1234&year=42");
  await render(<App />);

  const params = () => new URLSearchParams(window.location.search);
  await expect.poll(() => params().get("year"), { timeout: 5000 }).toBe("42");
  expect(params().get("seed")).toBe("1234");
});

test("writes the world into the URL once the year settles", async () => {
  // The sync is deliberately debounced, so the URL lags the sliders slightly.
  window.history.replaceState(null, "", "/");
  await render(<App />);

  const params = () => new URLSearchParams(window.location.search);
  await expect.poll(() => params().get("year"), { timeout: 5000 }).toBe("0");
  expect(params().get("seed")).toBe("42");
  expect(params().get("populationSize")).toBe("1000");
});
