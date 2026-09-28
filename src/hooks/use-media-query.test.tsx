import { render } from "vitest-browser-react";
import { expect, test } from "vitest";
import { useMediaQuery } from "./use-media-query";

function Probe({ query }: { query: string }) {
  const matches = useMediaQuery(query);
  return <span>{matches ? "match" : "no match"}</span>;
}

test("returns true when the query matches", async () => {
  const { getByText } = await render(<Probe query="(min-width: 1px)" />);
  await expect.element(getByText("match")).toBeVisible();
});

test("returns false when the query does not match", async () => {
  const { getByText } = await render(<Probe query="(min-width: 100000px)" />);
  await expect.element(getByText("no match")).toBeVisible();
});
