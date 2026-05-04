import { cn } from "@/lib/utils";

export type FilterSelectOption = { value: string; label: string };

type FilterSelectProps = Omit<
  React.ComponentProps<"select">,
  "children" | "size"
> & {
  options: FilterSelectOption[];
  placeholderLabel?: string;
};

export function FilterSelect({
  className,
  options,
  placeholderLabel = "All",
  ...props
}: FilterSelectProps) {
  return (
    <select
      className={cn(
        "border-input bg-background ring-offset-background focus-visible:ring-ring h-9 min-w-[8rem] rounded-md border px-3 text-sm shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <option value="">{placeholderLabel}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
