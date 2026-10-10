import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useEffect, useRef, type ReactNode } from 'react'

/** Where the menu should appear, in viewport coordinates. */
export type MenuPoint = { x: number; y: number };

/** Which way the menu hangs from its point. `'right'` puts its left edge on
 * the point and grows rightwards, the way a menu falls under a right-click;
 * `'left'` puts its right edge there and grows leftwards, for a menu opened
 * from a control it should sit beside rather than cover. Only the menu knows
 * how wide it is, so this is its decision to make, not the caller's. */
export type MenuSide = "right" | "left";

export type MenuItem =
  // Actions use the leading slot for their icon. Radio rows keep that slot for
  // the selected dot and may put a format-preview icon beside it.
  | {
      kind: "action";
      label: string;
      onSelect: () => void;
      icon?: ReactNode;
      destructive?: boolean;
      disabled?: boolean;
    }
  | {
      kind: "radio";
      label: string;
      checked: boolean;
      onSelect: () => void;
      icon?: ReactNode;
      /** A line under the label saying what choosing it does. */
      description?: string;
      /** A small decorative picture of what choosing it looks like, drawn in
       *  place of the icon, wider than one; the label still says it. */
      preview?: ReactNode;
    }
  // An option that is on or off on its own, beside rather than among a set of
  // radios. Its leading slot is its icon; the tick sits where a radio's dot does.
  | {
      kind: "checkbox";
      label: string;
      checked: boolean;
      onSelect: () => void;
      icon?: ReactNode;
      disabled?: boolean;
    }
  | {
      kind: "submenu";
      label: string;
      items: readonly SubmenuItem[];
      icon?: ReactNode;
      /** What is chosen in it now, shown beside the label. */
      value?: string;
      /** Shown but not openable, with `description` saying why. */
      disabled?: boolean;
      /** A line under the label, such as why it is disabled. */
      description?: string;
    }
  | { kind: "label"; label: string }
  | { kind: "separator" };

type SubmenuItem = Extract<MenuItem, { kind: "action" | "radio" | "label" | "separator" }>;

function ItemLabel({
  label,
  description,
}: {
  label: string;
  description?: string;
}) {
  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span>{label}</span>
      {description && (
        <span className="text-xs text-muted-foreground">{description}</span>
      )}
    </span>
  );
}

function MenuRows({ items }: { items: readonly MenuItem[] }) {
  const rows: ReactNode[] = [];
  for (let index = 0; index < items.length; index++) {
    const item = items[index]!;
    if (item.kind === "radio") {
      const start = index;
      const radios: Extract<MenuItem, { kind: "radio" }>[] = [];
      while (index < items.length && items[index]!.kind === "radio") {
        radios.push(items[index] as Extract<MenuItem, { kind: "radio" }>);
        index++;
      }
      index--;
      rows.push(
        <DropdownMenuRadioGroup
          key={start}
          value={String(radios.findIndex((option) => option.checked))}
        >
          {radios.map((option, radioIndex) => (
            <DropdownMenuRadioItem
              key={radioIndex}
              value={String(radioIndex)}
              onSelect={option.onSelect}
            >
              {option.preview ? (
                <span className="context-menu-preview" aria-hidden="true">
                  {option.preview}
                </span>
              ) : (
                option.icon
              )}
              <ItemLabel
                label={option.label}
                description={option.description}
              />
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>,
      );
    } else if (item.kind === "separator") {
      rows.push(<DropdownMenuSeparator key={index} />);
    } else if (item.kind === "label") {
      rows.push(
        <DropdownMenuLabel key={index}>{item.label}</DropdownMenuLabel>,
      );
    } else if (item.kind === "submenu") {
      rows.push(
        <DropdownMenuSub key={index}>
          <DropdownMenuSubTrigger disabled={item.disabled}>
            {item.icon}
            <ItemLabel label={item.label} description={item.description} />
            {item.value && (
              <span className="ml-auto text-xs text-muted-foreground">
                {item.value}
              </span>
            )}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent collisionPadding={8}>
            <DropdownMenuGroup>
              <MenuRows items={item.items} />
            </DropdownMenuGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>,
      );
    } else if (item.kind === "checkbox") {
      rows.push(
        <DropdownMenuCheckboxItem
          key={index}
          checked={item.checked}
          disabled={item.disabled}
          onSelect={item.onSelect}
        >
          {item.icon}
          {item.label}
        </DropdownMenuCheckboxItem>,
      );
    } else {
      rows.push(
        <DropdownMenuItem
          key={index}
          disabled={item.disabled}
          variant={item.destructive ? "destructive" : "default"}
          onSelect={item.onSelect}
        >
          {item.icon}
          {item.label}
        </DropdownMenuItem>,
      );
    }
  }
  return rows;
}

/** A shared menu for the existing point-based callers. Radix owns positioning,
 * typeahead, keyboard navigation, submenus and dismissal. */
export function ContextMenu({
  point,
  side = "right",
  items,
  ariaLabel,
  onClose,
}: {
  point: MenuPoint;
  side?: MenuSide;
  items: readonly MenuItem[];
  ariaLabel: string;
  onClose: () => void;
}) {
  const previous = useRef(document.activeElement as HTMLElement | null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const close = (event: Event) => {
      // Menu content may scroll without moving its anchor in the workspace.
      if (
        event.type === "scroll" &&
        event.target instanceof Element &&
        event.target.closest(
          '[data-slot="dropdown-menu-content"], [data-slot="dropdown-menu-sub-content"]',
        )
      )
        return;
      closeRef.current();
    };
    const frame = requestAnimationFrame(() => {
      window.addEventListener("scroll", close, true);
      window.addEventListener("resize", close);
    });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, []);
  return (
    <DropdownMenu
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      modal={false}
    >
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden="true"
          tabIndex={-1}
          className="pointer-events-none fixed size-0"
          style={{ left: point.x, top: point.y }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        aria-label={ariaLabel}
        align={side === "left" ? "end" : "start"}
        sideOffset={0}
        collisionPadding={8}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          // A selection may deliberately focus the editor or open another modal.
          if (
            document.activeElement === document.body &&
            previous.current?.isConnected
          )
            previous.current.focus();
        }}
        onEscapeKeyDown={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
      >
        <DropdownMenuGroup>
          <MenuRows items={items} />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
