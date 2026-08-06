import { render } from "vitest-browser-react";
import { expect, test } from "vitest";
import App from "./App.jsx";

test("renders the title", async () => {
  const { getByText } = await render(<App />);

  await expect.element(getByText("Starter")).toBeVisible();
});
