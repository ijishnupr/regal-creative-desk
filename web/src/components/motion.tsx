import { useCallback, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode, type CSSProperties } from "react";
import { Link, useLocation, useNavigate, type To } from "react-router-dom";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
type VTDoc = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };

/** Run a DOM update inside a View Transition when the browser supports it. */
type VTDocAsync = Document & { startViewTransition?: (cb: () => Promise<void> | void) => { finished: Promise<void> } };

let vtActive = false;
let waiter: { path: string; done: () => void } | null = null;
/** True while a view transition is rendering the next page (that page then skips its own fade-in). */
export const inViewTransition = () => vtActive;

/** Wait (briefly) until no route fallback skeleton is on screen, i.e. the real page has rendered. */
function whenPageRendered(maxMs = 500) {
  return new Promise<void>((resolve) => {
    const start = performance.now();
    const check = () => (!document.querySelector("[data-route-fallback]") || performance.now() - start > maxMs) ? resolve() : requestAnimationFrame(check);
    check();
  });
}

/** Called by the app shell after a route has committed to the DOM. */
export function notifyRouteCommitted(path: string) {
  if (waiter && waiter.path === path) {
    const w = waiter; waiter = null;
    void whenPageRendered().then(w.done);
  }
}

/**
 * Run a navigation inside a View Transition. The router renders route changes
 * asynchronously, so the transition waits until the new page has actually
 * committed (and its code has loaded) before animating; otherwise it would
 * animate old→old and the real page would pop in afterwards (flicker).
 */
export function withViewTransition(update: () => void, path: string) {
  const d = document as VTDocAsync;
  if (!d.startViewTransition || reduced()) { update(); return; }
  const t = d.startViewTransition(() => new Promise<void>((resolve) => {
    vtActive = true;
    const done = () => { vtActive = false; resolve(); };
    waiter = { path, done };
    setTimeout(() => { if (waiter?.done === done) { waiter = null; done(); } }, 800); // safety net
    update();
  }));
  t.finished.catch(() => undefined);
}

const pathOf = (to: To) => (typeof to === "string" ? to : to.pathname ?? "").split(/[?#]/)[0] || "/";

/** navigate() with a fluid page transition (cross-fade + shared campaign covers). */
export function useVTNavigate() {
  const navigate = useNavigate();
  const loc = useLocation();
  return useCallback((to: To) => {
    const path = pathOf(to);
    if (path === loc.pathname) { navigate(to); return; } // same page (e.g. only the query changes)
    withViewTransition(() => navigate(to), path);
  }, [navigate, loc.pathname]);
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

export function VLink({ to, children, className, style, onMouseEnter, morph }: {
  to: string; children: ReactNode; className?: string; style?: CSSProperties; onMouseEnter?: () => void;
  /** Campaign id whose cover should morph into the next page. */
  morph?: string;
}) {
  const click = useVTClick();
  return <Link to={to} className={className} style={style} onMouseEnter={onMouseEnter}
    onClick={(e) => { if (morph) startCoverMorph(morph, e.currentTarget); click(e, to); }}>{children}</Link>;
}

/**
 * Shared-element morph for campaign covers. Only ONE cover may carry the name
 * (the campaign being opened / returned from); others would float as ghosts.
 */
let morphId: string | null = null;
export const getMorphId = () => morphId;
export const coverVT = (id: string, always = false): CSSProperties =>
  (always || id === morphId ? { viewTransitionName: `cover-${id}` } : {}) as CSSProperties;
/** Tag the clicked card's cover right before the transition snapshots the old page. */
export function startCoverMorph(id: string, card: HTMLElement | null) {
  morphId = id;
  const cover = card?.querySelector<HTMLElement>(".cover");
  if (cover) cover.style.setProperty("view-transition-name", `cover-${id}`);
}

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
