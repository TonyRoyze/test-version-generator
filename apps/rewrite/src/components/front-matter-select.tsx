import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, Plus } from "lucide-react";
import { Fragment, useRef, useState, type ReactNode } from "react";

/** Searchable metadata: choosing an existing value retains its spelling.
 * Topics can be created and toggled; choosing the selected difficulty clears it. */
export function FrontMatterSelect({
  icon,
  label,
  options,
  selected,
  multiple,
  onChange,
  onCreate,
  renderValue,
}: {
  icon: ReactNode;
  label: string;
  options: readonly { value: string; label: string }[];
  selected: readonly string[];
  multiple: boolean;
  onChange: (values: string[]) => void;
  onCreate?: (value: string) => void;
  renderValue: (value: string) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const trimmed = query.trim();
  const matching = options.filter((option) =>
    option.label.toLowerCase().includes(trimmed.toLowerCase()),
  );
  const creatable =
    onCreate !== undefined &&
    trimmed.length > 0 &&
    !options.some((option) => option.label === trimmed);

  const afterChoose = () => {
    setQuery("");
    if (multiple) search.current?.focus();
    else setOpen(false);
  };
  const choose = (value: string) => {
    onChange(
      multiple
        ? selected.includes(value)
          ? selected.filter((item) => item !== value)
          : [...selected, value]
        : selected.includes(value)
          ? []
          : [value],
    );
    afterChoose();
  };

  return (
    <div className="front-matter-field">
      <span className="front-matter-label">
        {icon}
        {label}
      </span>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="plain"
            size="content"
            className="front-matter-value"
            aria-label={label}
          >
            {selected.length === 0 ? (
              <span className="front-matter-blank">Empty</span>
            ) : (
              selected.map((value) => (
                <Fragment key={value}>{renderValue(value)}</Fragment>
              ))
            )}
          </Button>
        </PopoverTrigger>
        {open && (
          <PopoverContent
            className="front-matter-list"
            align="start"
            role="group"
            aria-label={label}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              search.current?.focus();
            }}
            onEscapeKeyDown={(event) => event.stopPropagation()}
          >
            <Command shouldFilter={false} loop>
              <CommandInput
                ref={search}
                aria-label={`Filter ${label}`}
                value={query}
                onValueChange={setQuery}
                placeholder={
                  onCreate
                    ? `Search or add a ${label.replace(/s$/, "")}`
                    : "Search"
                }
              />
              <CommandList className="front-matter-options">
                <CommandEmpty>Nothing to choose</CommandEmpty>
                <CommandGroup>
                  {matching.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={`choose:${option.value}`}
                      className="front-matter-option"
                      data-chosen={
                        selected.includes(option.value) ? "true" : undefined
                      }
                      onSelect={() => choose(option.value)}
                    >
                      {renderValue(option.value)}
                      {selected.includes(option.value) && (
                        <Check aria-hidden="true" />
                      )}
                    </CommandItem>
                  ))}
                  {creatable && (
                    <CommandItem
                      value={`create:${trimmed}`}
                      className="front-matter-option"
                      onSelect={() => {
                        onCreate?.(trimmed);
                        afterChoose();
                      }}
                    >
                      <Plus aria-hidden="true" />
                      Add {renderValue(trimmed)}
                    </CommandItem>
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        )}
      </Popover>
    </div>
  );
}
