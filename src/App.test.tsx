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
