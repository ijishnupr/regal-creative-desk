import { useCallback, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { Link, useNavigate, type To } from "react-router-dom";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
type VTDoc = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };

/** Run a DOM update inside a View Transition when the browser supports it. */
export function withViewTransition(update: () => void) {
  const d = document as VTDoc;
  if (!d.startViewTransition || reduced()) { update(); return; }
  const root = document.documentElement;
  root.classList.add("vt");
  const t = d.startViewTransition(() => flushSync(update));
  t.finished.finally(() => root.classList.remove("vt"));
}

/** navigate() with a fluid page transition (cross-fade + shared campaign covers). */
export function useVTNavigate() {
  const navigate = useNavigate();
  return useCallback((to: To) => withViewTransition(() => navigate(to)), [navigate]);
}

/** onClick for <Link>/<NavLink>: keeps normal behaviour for new-tab clicks. */
export function useVTClick() {
  const vnav = useVTNavigate();
  return useCallback((e: MouseEvent<HTMLAnchorElement>, to: To) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    vnav(to);
  }, [vnav]);
}

export function VLink({ to, children, className, style, onMouseEnter }: {
  to: string; children: ReactNode; className?: string; style?: CSSProperties; onMouseEnter?: () => void;
}) {
  const click = useVTClick();
  return <Link to={to} className={className} style={style} onMouseEnter={onMouseEnter} onClick={(e) => click(e, to)}>{children}</Link>;
}

/** Shared-element name so a campaign cover morphs between pages. */
export const coverVT = (id: string): CSSProperties => ({ viewTransitionName: `cover-${id}` } as CSSProperties);

/**
 * Measures the active child (selector) inside a container and returns the
 * style for a sliding indicator that glides to it.
 */
export function useSlidingIndicator<T extends HTMLElement>(activeSelector: string, deps: unknown[], axis: "x" | "y" = "x") {
  const ref = useRef<T>(null);
  const [style, setStyle] = useState<CSSProperties>({ opacity: 0 });
  const measure = useCallback(() => {
    const box = ref.current;
    const el = box?.querySelector<HTMLElement>(activeSelector);
    if (!box || !el) { setStyle((s) => ({ ...s, opacity: 0 })); return; }
    setStyle(axis === "x"
      ? { opacity: 1, width: el.offsetWidth, transform: `translateX(${el.offsetLeft}px)` }
      : { opacity: 1, height: el.offsetHeight, transform: `translateY(${el.offsetTop}px)` });
  }, [activeSelector, axis]);
  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, ...deps]);
  return [ref, style] as const;
}

/** Tab bar with a sliding underline. */
export function TabBar<K extends string>({ tabs, value, onChange, style }: {
  tabs: readonly (readonly [K, ReactNode])[]; value: K; onChange: (k: K) => void; style?: CSSProperties;
}) {
  const [ref, ind] = useSlidingIndicator<HTMLDivElement>("button.active", [value, tabs.map((t) => String(t[1])).join("|")]);
  return (
    <div className="tabbar" ref={ref} style={style} role="tablist">
      {tabs.map(([k, label]) => (
        <button key={k} role="tab" aria-selected={value === k} className={value === k ? "active" : ""} onClick={() => onChange(k)}>{label}</button>
      ))}
      <span className="tab-ind" style={ind} aria-hidden="true" />
    </div>
  );
}

/** Material-style touch ripple for buttons (one global listener). */
export function installRipples() {
  document.addEventListener("pointerdown", (e) => {
    if (reduced()) return;
    const host = (e.target as Element | null)?.closest<HTMLElement>(".btn, .send, .seg button, .tabnav a, .iconbtn");
    if (!host || (host as HTMLButtonElement).disabled) return;
    const r = host.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2.2;
    const s = document.createElement("span");
    s.className = "ripple";
    s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    host.appendChild(s);
    s.addEventListener("animationend", () => s.remove());
  }, { passive: true });
}
