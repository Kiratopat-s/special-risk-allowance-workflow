// @vitest-environment jsdom
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Select } from "@/components/workflow-ui/form-controls";
import { DatePicker } from "@/components/workflow-ui/date-picker";
import {
  Dialog,
  DialogBody,
  DialogTitle,
} from "@/components/workflow-ui/dialog";
import { installPickerMedia } from "./helpers/picker-media";

const options = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved", disabled: true },
];
let setDesktop: ReturnType<typeof installPickerMedia>;
beforeEach(() => {
  setDesktop = installPickerMedia(true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function DateFixture({
  kind = "date",
  initial = "2026-09-11",
  change = vi.fn(),
  commitOnBlur = false,
}: {
  kind?: "date" | "month";
  initial?: string;
  change?: (value: string) => void;
  commitOnBlur?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DatePicker
        label="วันที่ทดสอบ"
        kind={kind}
        value={value}
        commitOnBlur={commitOnBlur}
        onValueChange={(next) => {
          setValue(next);
          change(next);
        }}
      />
      <output data-testid="value">{value}</output>
      <button>Next field</button>
    </>
  );
}
describe("adaptive pickers", () => {
  it("uses a custom menu with empty and disabled options on desktop", async () => {
    const change = vi.fn();
    render(
      <Select
        label="Status"
        options={options}
        value=""
        onValueChange={change}
      />,
    );
    expect(document.querySelector("select")).toBeNull();
    await userEvent.click(screen.getByRole("combobox", { name: /Status/ }));
    expect(
      screen
        .getByRole("option", { name: "Approved" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
    await userEvent.click(screen.getByRole("option", { name: "Pending" }));
    expect(change).toHaveBeenCalledExactlyOnceWith("PENDING");
  });
  it("supports typeahead, Escape and focus restoration inside a dialog", async () => {
    const change = vi.fn();
    render(
      <Dialog open onClose={vi.fn()}>
        <DialogTitle>Editor</DialogTitle>
        <DialogBody>
          <Select
            label="Status"
            options={options}
            value=""
            onValueChange={change}
          />
        </DialogBody>
      </Dialog>,
    );
    const trigger = screen.getByRole("combobox", { name: /Status/ });
    await userEvent.click(trigger);
    await userEvent.keyboard("p{Enter}");
    expect(change).toHaveBeenCalledWith("PENDING");
    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(document.activeElement).toBe(trigger);
    expect(screen.getByRole("dialog", { name: "Editor" })).toBeTruthy();
  });
  it("retains native selects on touch and keeps their value when capabilities change", () => {
    setDesktop(false);
    const change = vi.fn();
    render(
      <Select
        label="Status"
        options={options}
        defaultValue="DRAFT"
        onValueChange={change}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "PENDING" },
    });
    expect(change).toHaveBeenCalledExactlyOnceWith("PENDING");
    setDesktop(true);
    expect(screen.getByRole("combobox").textContent).toContain("Pending");
    setDesktop(false);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(
      "PENDING",
    );
    expect(change).toHaveBeenCalledTimes(1);
  });
  it("hydrates the native SSR fallback without mismatches or a change callback", async () => {
    const change = vi.fn();
    const ui = (
      <Select
        label="Status"
        options={options}
        value="DRAFT"
        onValueChange={change}
      />
    );
    const markup = renderToString(ui);
    expect(markup).toContain("<select");
    const container = document.createElement("div");
    container.innerHTML = markup;
    document.body.append(container);
    const errors = vi.fn();
    const root = hydrateRoot(container, ui, { onRecoverableError: errors });
    await waitFor(() => expect(container.querySelector("select")).toBeNull());
    expect(errors).not.toHaveBeenCalled();
    expect(change).not.toHaveBeenCalled();
    act(() => root.unmount());
    container.remove();
  });
  it("selects a Thai calendar month with a Gregorian ISO value", async () => {
    const change = vi.fn();
    render(<DateFixture kind="month" initial="2026-09" change={change} />);
    await userEvent.click(
      screen.getByRole("button", { name: "เปิดวันที่ทดสอบ" }),
    );
    await userEvent.click(screen.getByRole("radio", { name: "ตุลาคม" }));
    expect(change).toHaveBeenCalledExactlyOnceWith("2026-10");
    expect(screen.getByTestId("value").textContent).toBe("2026-10");
  });
  it("pages years and waits for the final month before changing a URL filter", async () => {
    const change = vi.fn();
    render(
      <DateFixture
        kind="month"
        initial="2026-09"
        commitOnBlur
        change={change}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "เปิดวันที่ทดสอบ" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "เลือกปี" }));
    expect(screen.getAllByRole("radio").length).toBeLessThanOrEqual(80);
    await userEvent.click(
      screen.getByRole("button", { name: "ช่วงปีก่อนหน้า" }),
    );
    await userEvent.click(screen.getByRole("radio", { name: "1950" }));
    expect(change).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("radio", { name: "ธันวาคม" }));
    expect(change).toHaveBeenCalledExactlyOnceWith("1950-12");
  });
  it("discards an unfinished calendar selection on Escape", async () => {
    const change = vi.fn();
    render(<DateFixture change={change} />);
    await userEvent.click(
      screen.getByRole("button", { name: "เปิดวันที่ทดสอบ" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "เลือกปี" }));
    await userEvent.click(screen.getByRole("radio", { name: "2027" }));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByRole("spinbutton", { name: "ปี" }).textContent).toBe(
      "2026",
    );
  });
  it("commits valid keyboard month edits on blur, with a named field group", async () => {
    const change = vi.fn();
    render(
      <DateFixture
        kind="month"
        initial="2026-09"
        commitOnBlur
        change={change}
      />,
    );
    expect(screen.getByRole("group", { name: "วันที่ทดสอบ" })).toBeTruthy();
    await userEvent.click(screen.getByRole("spinbutton", { name: "ปี" }));
    await userEvent.keyboard("{ArrowUp}");
    expect(change).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Next field" }));
    expect(change).toHaveBeenCalledExactlyOnceWith("2027-09");
  });
  it("keeps disabled date fields and menus non-interactive", () => {
    const change = vi.fn();
    render(
      <>
        <DatePicker
          label="Locked date"
          kind="date"
          value="2026-09-11"
          disabled
          onValueChange={change}
        />
        <Select
          label="Locked status"
          value="DRAFT"
          options={options}
          disabled
          onValueChange={change}
        />
      </>,
    );
    expect(
      (
        screen.getByRole("button", {
          name: "เปิดLocked date",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByRole("combobox").getAttribute("aria-disabled")).toBe(
      "true",
    );
    expect(change).not.toHaveBeenCalled();
  });
  it("selects an individual date and restores focus after closing the calendar", async () => {
    const change = vi.fn();
    render(<DateFixture change={change} />);
    const button = screen.getByRole("button", { name: "เปิดวันที่ทดสอบ" });
    await userEvent.click(button);
    await userEvent.click(screen.getByRole("gridcell", { name: "15" }));
    expect(change).toHaveBeenCalledExactlyOnceWith("2026-09-15");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(button);
  });
  it("preserves native date input values across desktop/touch switching without callbacks", () => {
    setDesktop(false);
    const change = vi.fn();
    render(<DateFixture initial="2024-02-29" change={change} />);
    expect(
      document.querySelector('input[type="date"]')?.getAttribute("value"),
    ).toBe("2024-02-29");
    setDesktop(true);
    expect(document.querySelector('input[type="date"]')).toBeNull();
    setDesktop(false);
    expect(
      (screen.getByLabelText("วันที่ทดสอบ") as HTMLInputElement).value,
    ).toBe("2024-02-29");
    expect(change).not.toHaveBeenCalled();
  });
  it("closes an open picker when switching input capabilities", async () => {
    const change = vi.fn();
    render(<DateFixture change={change} />);
    await userEvent.click(
      screen.getByRole("button", { name: "เปิดวันที่ทดสอบ" }),
    );
    setDesktop(false);
    expect(screen.queryByRole("dialog")).toBeNull();
    setDesktop(true);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByTestId("value").textContent).toBe("2026-09-11");
  });
  it("clears optional URL month filters explicitly", async () => {
    const change = vi.fn();
    render(
      <DateFixture
        kind="month"
        initial="2026-09"
        commitOnBlur
        change={change}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "ล้างวันที่ทดสอบ" }),
    );
    expect(change).toHaveBeenCalledExactlyOnceWith("");
  });
  it("does not submit the previous date after an incomplete form edit", async () => {
    render(<DateFixture />);
    const day = screen.getByRole("spinbutton", { name: "วัน" });
    await userEvent.click(day);
    await userEvent.keyboard("{Backspace}");
    await userEvent.click(screen.getByRole("button", { name: "Next field" }));
    expect(screen.getByTestId("value").textContent).toBe("");
    expect(screen.getByText("กรุณากรอกวันที่ให้ครบและถูกต้อง")).toBeTruthy();
    expect(screen.getByRole("spinbutton", { name: "ปี" }).textContent).toBe(
      "2026",
    );
  });
  it("keeps incomplete URL-filter edits local instead of navigating", async () => {
    const change = vi.fn();
    render(
      <DateFixture
        kind="month"
        initial="2026-09"
        commitOnBlur
        change={change}
      />,
    );
    await userEvent.click(screen.getByRole("spinbutton", { name: "เดือน" }));
    await userEvent.keyboard("{Backspace}");
    await userEvent.click(screen.getByRole("button", { name: "Next field" }));
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByText("กรุณากรอกวันที่ให้ครบและถูกต้อง")).toBeTruthy();
  });
});
