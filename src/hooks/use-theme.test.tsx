import { render } from "vitest-browser-react";
import { beforeEach, expect, test } from "vitest";
import { useTheme } from "./use-theme";

function ThemeProbe() {
  const [isDark, toggle] = useTheme();
  return (
    <button type="button" onClick={toggle}>
      {isDark ? "dark" : "light"}
    </button>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

test("starts light when nothing is stored", async () => {
  const { getByText } = await render(<ThemeProbe />);
  await expect.element(getByText("light")).toBeVisible();
  expect(document.documentElement.classList.contains("dark")).toBe(false);
});

test("respects a stored dark preference", async () => {
  localStorage.setItem("theme", "dark");
  const { getByText } = await render(<ThemeProbe />);
  await expect.element(getByText("dark")).toBeVisible();
  expect(document.documentElement.classList.contains("dark")).toBe(true);
});

test("toggling flips the theme and persists it", async () => {
  const { getByText } = await render(<ThemeProbe />);
  await getByText("light").click();
  await expect.element(getByText("dark")).toBeVisible();
  expect(localStorage.getItem("theme")).toBe("dark");
  expect(document.documentElement.classList.contains("dark")).toBe(true);

  await getByText("dark").click();
  await expect.element(getByText("light")).toBeVisible();
  expect(localStorage.getItem("theme")).toBe("light");
  expect(document.documentElement.classList.contains("dark")).toBe(false);
});
