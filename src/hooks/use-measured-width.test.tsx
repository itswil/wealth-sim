import { render } from "vitest-browser-react";
import { expect, test } from "vitest";
import { useMeasuredWidth } from "./use-measured-width";

function WidthProbe({ minWidth, boxWidth }: { minWidth?: number; boxWidth: number }) {
  const [ref, width] = useMeasuredWidth(minWidth);
  return (
    <div ref={ref} style={{ width: boxWidth }}>
      {width}
    </div>
  );
}

test("reports the measured container width", async () => {
  const { getByText } = await render(<WidthProbe boxWidth={480} />);
  await expect.element(getByText("480")).toBeVisible();
});

test("enforces the default minimum width", async () => {
  const { getByText } = await render(<WidthProbe boxWidth={50} />);
  await expect.element(getByText("320")).toBeVisible();
});

test("enforces a custom minimum width", async () => {
  const { getByText } = await render(<WidthProbe boxWidth={100} minWidth={200} />);
  await expect.element(getByText("200")).toBeVisible();
});
