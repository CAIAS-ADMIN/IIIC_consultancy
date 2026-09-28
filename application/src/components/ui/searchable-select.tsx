"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchableOption = { code: string; label: string };

/**
 * A dropdown with a "type to search" box — used for any list long enough that
 * scrolling to find an entry is slow (departments, staff, master data). Looks
 * like `SelectTrigger`/`SelectContent`; the list renders in a portal with fixed
 * positioning so a card's `overflow-hidden` can never clip it.
 *
 * Keyboard: Enter/Space/↓ opens; typing filters; ↑/↓ move; Enter picks; Esc closes.
 */
export function SearchableSelect({
  id,
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Type to search…",
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string;
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const listId = React.useId();

  const selected = options.find((o) => o.code === value);
  const needle = query.trim().toLowerCase();
  const filtered = needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;

  const place = React.useCallback(() => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
  }, []);

  function openPanel() {
    if (disabled) return;
    place();
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.code === value)));
    setOpen(true);
  }

  function close(refocus = true) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function pick(code: string) {
    onChange(code);
    close();
  }

  React.useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onScrollOrResize = () => place();
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) close(false);
    };
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, place]);

  // Keep the highlighted option in view while arrowing through a long list.
  React.useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function onSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = filtered[active];
      if (option) pick(option.code);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      close(false);
    }
  }

  // Open upwards when there isn't room below the trigger.
  const PANEL_MAX = 320;
  const openUp = rect ? window.innerHeight - rect.bottom < PANEL_MAX && rect.top > window.innerHeight - rect.bottom : false;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close() : openPanel())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openPanel();
          }
        }}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-md border border-input-border bg-card px-3 py-2 text-left text-base text-foreground md:h-10 md:text-sm",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected?.label ?? placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-50 flex flex-col overflow-hidden rounded-md border border-border bg-card shadow-md"
            style={{
              left: rect.left,
              width: Math.max(rect.width, 224),
              maxHeight: PANEL_MAX,
              ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
            }}
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onSearchKeyDown}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                aria-controls={listId}
                aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
                className="h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <ul id={listId} role="listbox" className="overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">No matches for “{query.trim()}”</li>
              ) : (
                filtered.map((option, index) => (
                  <li
                    key={option.code}
                    id={`${listId}-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={option.code === value}
                    onMouseEnter={() => setActive(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(option.code)}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-2 text-sm text-foreground",
                      index === active && "bg-background",
                      option.code === value && "font-medium"
                    )}
                  >
                    {option.code === value && <Check className="absolute left-2 h-4 w-4 text-primary" aria-hidden />}
                    {option.label}
                  </li>
                ))
              )}
            </ul>
          </div>,
          document.body
        )}
    </>
  );
}
