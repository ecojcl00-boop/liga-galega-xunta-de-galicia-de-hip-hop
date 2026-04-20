/**
 * MobileSelect — renders a native bottom-sheet drawer on mobile,
 * falls back to the standard shadcn Select on desktop.
 *
 * Drop-in replacement API:
 *   <MobileSelect value={v} onValueChange={fn} placeholder="Pick one">
 *     <MobileSelectItem value="a">Option A</MobileSelectItem>
 *   </MobileSelect>
 */
import React, { useState, useEffect } from "react";
import { ChevronDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 1024);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return mobile;
}

// ─── Item child ────────────────────────────────────────────────
export function MobileSelectItem({ value, children, disabled }) {
  // Rendered only by MobileSelect internally
  return null;
}
MobileSelectItem.displayName = "MobileSelectItem";

// ─── Main component ─────────────────────────────────────────────
export function MobileSelect({
  value,
  onValueChange,
  placeholder = "Seleccionar…",
  disabled,
  className,
  triggerClassName,
  children,
  title,
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  // Collect items from children
  const items = React.Children.toArray(children)
    .filter((c) => c?.type?.displayName === "MobileSelectItem")
    .map((c) => ({ value: c.props.value, label: c.props.children, disabled: c.props.disabled }));

  const selectedLabel = items.find((i) => i.value === value)?.label ?? null;

  const handleSelect = (itemValue) => {
    onValueChange?.(itemValue);
    setOpen(false);
  };

  // ── Desktop: standard select ─────────────────────────────────
  if (!isMobile) {
    return (
      <select
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onValueChange?.(e.target.value)}
        className={cn(
          "flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
          "focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          triggerClassName,
          className
        )}
      >
        {!value && <option value="">{placeholder}</option>}
        {items.map((item) => (
          <option key={item.value} value={item.value} disabled={item.disabled}>
            {item.label}
          </option>
        ))}
      </select>
    );
  }

  // ── Mobile: custom bottom-sheet drawer ───────────────────────
  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
          "focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 select-none",
          triggerClassName,
          className
        )}
      >
        <span className={selectedLabel ? "text-foreground" : "text-muted-foreground"}>
          {selectedLabel ?? placeholder}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Bottom sheet */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-[70] bg-card rounded-t-2xl shadow-2xl transition-transform duration-300",
          open ? "translate-y-0" : "translate-y-full"
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Handle + header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="mx-auto w-10 h-1 rounded-full bg-muted-foreground/30 absolute left-1/2 -translate-x-1/2 top-2" />
          {title && <span className="text-sm font-semibold text-foreground pt-2">{title}</span>}
          <button
            onClick={() => setOpen(false)}
            className="ml-auto p-1 rounded-full text-muted-foreground hover:text-foreground select-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options list */}
        <ul className="overflow-y-auto max-h-[60vh] divide-y divide-border">
          {items.map((item) => (
            <li key={item.value}>
              <button
                type="button"
                disabled={item.disabled}
                onClick={() => handleSelect(item.value)}
                className={cn(
                  "w-full flex items-center justify-between px-5 py-4 text-sm text-left",
                  "disabled:opacity-40 disabled:cursor-not-allowed select-none",
                  item.value === value
                    ? "text-primary font-semibold bg-primary/5"
                    : "text-foreground hover:bg-accent"
                )}
              >
                <span>{item.label}</span>
                {item.value === value && <Check className="w-4 h-4 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export default MobileSelect;