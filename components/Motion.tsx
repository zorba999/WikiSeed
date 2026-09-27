"use client";

import Lenis from "lenis";
import { createElement, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { gsap, reduceMotion, ScrollTrigger, SplitText } from "@/lib/gsap";

const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;

let lenis: Lenis | null = null;
export const getLenis = () => lenis;

/** Lenis smooth scroll wired into GSAP's ticker + ScrollTrigger. */
export function SmoothScroll() {
  useEffect(() => {
    if (reduceMotion()) return;
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (t: number) => lenis?.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    // smooth in-page anchors
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a[href^='#']") as HTMLAnchorElement | null;
      if (!a) return;
      const el = document.querySelector(a.getAttribute("href")!);
      if (!el) return;
      e.preventDefault();
      lenis?.scrollTo(el as HTMLElement, { duration: 1.6, easing: (x) => 1 - Math.pow(1 - x, 4) });
    };
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      gsap.ticker.remove(tick);
      lenis?.destroy();
      lenis = null;
    };
  }, []);
  return null;
}

/** Custom cursor: dot + lagging ring that grows over [data-cursor] targets. */
export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    document.body.classList.add("has-cursor");
    const xd = gsap.quickTo(dot.current, "x", { duration: 0.12, ease: "power3" });
    const yd = gsap.quickTo(dot.current, "y", { duration: 0.12, ease: "power3" });
    const xr = gsap.quickTo(ring.current, "x", { duration: 0.55, ease: "power3" });
    const yr = gsap.quickTo(ring.current, "y", { duration: 0.55, ease: "power3" });
    const move = (e: PointerEvent) => {
      document.body.classList.add("cursor-live");
      xd(e.clientX);
      yd(e.clientY);
      xr(e.clientX);
      yr(e.clientY);
    };
    const over = (e: PointerEvent) => {
      const t = (e.target as HTMLElement).closest("[data-cursor]") as HTMLElement | null;
      ring.current?.classList.toggle("is-big", !!t);
      if (label.current) label.current.textContent = t?.dataset.cursor ?? "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerover", over);
    return () => {
      document.body.classList.remove("has-cursor", "cursor-live");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerover", over);
    };
  }, []);

  return (
    <>
      <div className="cursor" ref={dot} aria-hidden />
      <div className="cursor-ring" ref={ring} aria-hidden>
        <span ref={label} />
      </div>
    </>
  );
}

/** Magnetic hover for any element with [data-magnetic]. */
export function Magnetic() {
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const els = new Set<HTMLElement>();
    const move = (e: PointerEvent) => {
      const el = (e.target as HTMLElement).closest("[data-magnetic]") as HTMLElement | null;
      els.forEach((x) => {
        if (x !== el) {
          gsap.to(x, { x: 0, y: 0, duration: 0.8, ease: "elastic.out(1, 0.4)" });
          els.delete(x);
        }
      });
      if (!el) return;
      els.add(el);
      const r = el.getBoundingClientRect();
      gsap.to(el, {
        x: (e.clientX - r.left - r.width / 2) * 0.28,
        y: (e.clientY - r.top - r.height / 2) * 0.35,
        duration: 0.6,
        ease: "power3",
      });
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);
  return null;
}

/** Masked line-by-line text reveal, triggered on scroll or on mount. */
export function Reveal({
  as = "div",
  className,
  children,
  delay = 0,
  onMount = false,
  stagger = 0.09,
}: {
  as?: string;
  className?: string;
  children: ReactNode;
  delay?: number;
  onMount?: boolean;
  stagger?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  useIso(() => {
    if (!ref.current || reduceMotion()) return;
    const el = ref.current;
    let split: SplitText | null = null;
    const ctx = gsap.context(() => {
      split = SplitText.create(el, { type: "lines", mask: "lines", linesClass: "split-line-inner" });
      gsap.from(split.lines, {
        yPercent: 110,
        duration: 1.3,
        ease: "seed",
        stagger,
        delay: onMount ? delay + 0.2 : delay,
        scrollTrigger: onMount ? undefined : { trigger: el, start: "top 88%" },
      });
    });
    return () => {
      ctx.revert();
      split?.revert();
    };
  }, []);
  return createElement(as, { ref, className }, children);
}

/** Fade-up for blocks (cards, rows) as they enter the viewport. */
export function FadeUp({ children, className, y = 40, delay = 0 }: { children: ReactNode; className?: string; y?: number; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useIso(() => {
    if (!ref.current || reduceMotion()) return;
    const ctx = gsap.context(() => {
      gsap.from(ref.current, { y, opacity: 0, duration: 1.2, delay, ease: "bloom", scrollTrigger: { trigger: ref.current, start: "top 90%" } });
    });
    return () => ctx.revert();
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export function SeedIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden>
      <path d="M32 58V28" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 36c-10 0-16-7-16-16 10 0 16 7 16 16Z" fill="currentColor" />
      <path d="M32 31c0-9 6-16 16-16 0 9-6 16-16 16Z" fill="currentColor" opacity=".55" />
    </svg>
  );
}
