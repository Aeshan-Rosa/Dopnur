import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="12" fill="currentColor" />
      <path
        d="M23.8 8.5v15.8c0 4.9-2.8 7.8-7.2 7.8-4.1 0-7-2.7-7-6.6 0-3.9 2.9-6.7 7-6.7 1.6 0 2.9.4 4.1 1.2V8.5h3.1Z"
        fill="#F8F6EF"
      />
      <circle cx="16.7" cy="25.4" r="3.1" fill="currentColor" />
      <path
        d="M25 12.7c3.5-3.5 6.2-3.8 7.5-3.7-.1 3.7-2.8 7-7.5 7v-3.3Z"
        fill="#D6E4B8"
      />
    </svg>
  );
}
export function AgentMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M16 3c1.4 8.1 4.9 11.6 13 13-8.1 1.4-11.6 4.9-13 13C14.6 20.9 11.1 17.4 3 16 11.1 14.6 14.6 11.1 16 3Z"
        fill="currentColor"
      />
      <path
        d="M25 2c.4 2.5 1.5 3.6 4 4-2.5.4-3.6 1.5-4 4-.4-2.5-1.5-3.6-4-4 2.5-.4 3.6-1.5 4-4Z"
        fill="#B99379"
      />
    </svg>
  );
}
export function IconButton({
  label,
  children,
  onClick,
  active = false,
  disabled = false,
  className = "",
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      className={`icon-button ${active ? "active" : ""} ${className}`}
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const timer = setTimeout(
      () =>
        (
          ref.current?.querySelector<HTMLElement>("input,textarea,select") ||
          ref.current?.querySelector<HTMLElement>("button")
        )?.focus(),
      30,
    );
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab") {
        const items = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),input:not([disabled]),select,textarea,[tabindex="0"]',
          ) || [],
        ).filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        if (e.shiftKey && document.activeElement === items[0]) {
          e.preventDefault();
          items.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
          e.preventDefault();
          items[0].focus();
        }
      }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", key, true);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "wide" : ""} ${className}`}
      >
        <header className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <IconButton label="Close dialog" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        {children}
      </div>
    </div>
  );
}
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      className={`toggle ${checked ? "on" : ""}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}
export const errorText = (error: unknown) =>
  String(error instanceof Error ? error.message : error).replace(
    /^Error invoking remote method '[^']+': (?:Error: )?/,
    "",
  );
export function timeAgo(time: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  return minutes < 1
    ? "Just now"
    : minutes < 60
      ? `${minutes}m ago`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)}h ago`
        : new Date(time).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });
}
