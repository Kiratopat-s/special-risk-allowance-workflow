"use client";
import Autocomplete, { createFilterOptions } from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}
interface SelectProps {
  options: SelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
}
export function Select({
  options,
  value,
  onValueChange,
  placeholder = "เลือกข้อมูล",
  emptyText = "ไม่พบข้อมูล",
  searchPlaceholder,
  disabled,
  className,
}: SelectProps) {
  return (
    <Autocomplete
      options={options}
      value={options.find((option) => option.value === value) || null}
      onChange={(_, option) => onValueChange(option?.value || "")}
      disabled={disabled}
      className={className}
      fullWidth
      size="small"
      noOptionsText={emptyText}
      isOptionEqualToValue={(a, b) => a.value === b.value}
      filterOptions={createFilterOptions({
        stringify: (option) => `${option.label} ${option.description || ""}`,
      })}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={placeholder}
          slotProps={{
            htmlInput: {
              ...params.inputProps,
              "aria-label": searchPlaceholder || placeholder,
            },
          }}
        />
      )}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        return (
          <li key={key} {...rest}>
            <div>
              <p>{option.label}</p>
              {option.description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {option.description}
                </p>
              )}
            </div>
          </li>
        );
      }}
    />
  );
}
