// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { Search } from "lucide-react";
import { Checkbox } from "@/components/workflow-ui/form-controls";
import { Input } from "@/components/workflow-ui/input";
import { workflowTheme } from "@/components/workflow-ui/theme";
import { useState } from "react";

afterEach(cleanup);

it("uses one label and toggles once for a label click and a Space press", async () => {
  const changes: boolean[] = [];
  const { container } = render(
    <ThemeProvider theme={workflowTheme}>
      <Checkbox label="สิทธิ์อ่านเอกสาร" onChange={(e) => changes.push(e.target.checked)} />
    </ThemeProvider>,
  );
  await userEvent.click(screen.getByText("สิทธิ์อ่านเอกสาร"));
  expect(changes).toEqual([true]);
  expect(container.querySelectorAll("label")).toHaveLength(1);
  expect(container.querySelector("label label")).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("checkbox"));
  await userEvent.keyboard(" ");
  expect(changes).toEqual([true, false]);
});

it("supports an external row label without introducing a nested label", async () => {
  const change = vi.fn();
  const { container } = render(
    <label><Checkbox onChange={change} /><span>Read Department Expense Claims</span></label>,
  );
  await userEvent.click(screen.getByText("Read Department Expense Claims"));
  expect(change).toHaveBeenCalledTimes(1);
  expect(container.querySelector("label label")).toBeNull();
  expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
});

it("preserves standalone IDs, names, defaults, and disabled checkboxes", async () => {
  const change = vi.fn();
  render(<Checkbox id="selected" name="claimId" value="claim-1" aria-label="เลือกเอกสาร" defaultChecked disabled onChange={change} />);
  const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
  expect(checkbox.id).toBe("selected");
  expect(checkbox.name).toBe("claimId");
  expect(checkbox.value).toBe("claim-1");
  expect(checkbox.disabled).toBe(true);
  checkbox.click();
  expect(checkbox.checked).toBe(true);
  expect(change).not.toHaveBeenCalled();
});

it("does not toggle a disabled labeled checkbox", async () => {
  const change = vi.fn();
  render(<Checkbox label="Locked permission" disabled onChange={change} />);
  await userEvent.click(screen.getByText("Locked permission"));
  expect(change).not.toHaveBeenCalled();
});

it("keeps the search icon in the input and preserves input, blur, and Enter submission", async () => {
  const submit = vi.fn();
  const blur = vi.fn();
  function SearchForm() {
    const [value, setValue] = useState("เดิม");
    return <form onSubmit={(event) => { event.preventDefault(); submit(value); }}>
      <Input aria-label="ค้นหา" startAdornment={<Search data-testid="search-icon" />} value={value} onChange={(e) => setValue(e.target.value)} onBlur={blur} />
    </form>;
  }
  render(<ThemeProvider theme={workflowTheme}><SearchForm /></ThemeProvider>);
  const input = screen.getByRole("textbox", { name: "ค้นหา" });
  expect(screen.getByTestId("search-icon").closest(".MuiInputAdornment-root")).not.toBeNull();
  expect(screen.getByTestId("search-icon").closest(".MuiOutlinedInput-root")).toBe(input.parentElement);
  await userEvent.clear(input);
  await userEvent.type(input, "เอกสารใหม่{Enter}");
  expect(submit).toHaveBeenCalledExactlyOnceWith("เอกสารใหม่");
  fireEvent.blur(input);
  expect(blur).toHaveBeenCalledTimes(1);
});
