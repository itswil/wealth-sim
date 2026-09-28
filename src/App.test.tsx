import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { expect, test } from "vitest";
import App from "./App.jsx";

test("renders the title", async () => {
  const { getByText } = await render(<App />);

  await expect.element(getByText("Wealth Simulator")).toBeVisible();
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
  const chart = getByRole("img", { name: /arrow keys/i });
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
