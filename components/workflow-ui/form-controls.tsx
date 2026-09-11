"use client";
import * as React from "react";
import MuiCheckbox from "@mui/material/Checkbox";
import NativeSelect from "@mui/material/NativeSelect";
import MuiSelect from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import OutlinedInput from "@mui/material/OutlinedInput";
import { cn } from "@/lib/utils";
import { useDesktopPicker } from "@/lib/hooks/use-desktop-picker";

export function Checkbox({
  label,
  className,
  id,
  checked,
  defaultChecked,
  disabled,
  onChange,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: string;
}) {
  const generated = React.useId();
  return (
    <label
      className={cn(
        "inline-flex items-center gap-1 cursor-pointer text-sm",
        className,
      )}
      htmlFor={id || generated}
    >
      <MuiCheckbox
        size="small"
        id={id || generated}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        onChange={onChange}
        inputProps={props}
      />
      {label}
    </label>
  );
}
export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}
interface SelectProps {
  options: DropdownOption[];
  value?: string;
  defaultValue?: string;
  onValueChange: (value: string) => void;
  label: string;
  hideLabel?: boolean;
  className?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
}
export function Select({
  label,
  hideLabel = false,
  className,
  options,
  value,
  defaultValue = "",
  disabled,
  onValueChange,
  id: suppliedId,
  name,
  required,
}: SelectProps) {
  const generated = React.useId();
  const id = suppliedId || generated;
  const desktop = useDesktopPicker();
  const [localValue, setLocalValue] = React.useState(defaultValue);
  const selected = value ?? localValue;
  const change = (next: string) => {
    setLocalValue(next);
    onValueChange(next);
  };
  return (
    <div className={cn("min-w-0", className)}>
      <label
        id={`${id}-label`}
        htmlFor={id}
        className={
          hideLabel ? "sr-only" : "block text-sm text-muted-foreground mb-2"
        }
      >
        {label}
      </label>
      {desktop ? (
        <MuiSelect
          id={id}
          labelId={`${id}-label`}
          name={name}
          fullWidth
          size="small"
          displayEmpty
          value={selected}
          disabled={disabled}
          required={required}
          input={<OutlinedInput />}
          onChange={(event) => change(event.target.value)}
          MenuProps={{
            slotProps: {
              paper: { sx: { maxHeight: "min(360px, calc(100dvh - 32px))" } },
            },
          }}
        >
          {options.map((option) => (
            <MenuItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </MenuItem>
          ))}
        </MuiSelect>
      ) : (
        <NativeSelect
          fullWidth
          input={<OutlinedInput />}
          value={selected}
          disabled={disabled}
          onChange={(event) => change(event.target.value)}
          inputProps={{ id, name, required, "aria-labelledby": `${id}-label` }}
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </NativeSelect>
      )}
    </div>
  );
}
