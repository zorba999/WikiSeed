"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, reduceMotion } from "@/lib/gsap";
import { getLenis, SeedIcon } from "./Motion";

// Resolved once per page load when the preloader curtain lifts.
let resolveReady: () => void = () => {};
const ready = new Promise<void>((r) => (resolveReady = r));

/** Runs `cb` after the preloader finishes; returns a canceller for effect cleanup. */
export function onReady(cb: () => void) {
  let live = true;
  ready.then(() => live && cb());
  return () => {
    live = false;
  };
}

export function Preloader() {
  const root = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const finish = () => {
      resolveReady();
      getLenis()?.start();
      setDone(true);
    };
    if (reduceMotion()) return finish();
    getLenis()?.stop();
    window.scrollTo(0, 0);
    const counter = { v: 0 };
    const q = gsap.utils.selector(root);
    const tl = gsap.timeline({ onComplete: finish });
    tl.from(q(".preloader__word span"), { yPercent: 110, duration: 1, ease: "seed", stagger: 0.05 })
      .from(q(".preloader__seed"), { scale: 0, rotate: -90, duration: 1, ease: "bloom" }, 0.1)
      .to(counter, {
        v: 100,
        duration: 1.8,
        ease: "power2.inOut",
        onUpdate: () => {
          const el = q(".preloader__count")[0];
          if (el) el.textContent = String(Math.round(counter.v)).padStart(3, "0");
        },
      }, 0)
      .to(q(".preloader__bar"), { scaleX: 1, duration: 1.8, ease: "power2.inOut" }, 0)
      .to(q(".preloader__word span"), { yPercent: -110, duration: 0.8, ease: "seed", stagger: 0.03 }, "+=0.1")
      .to(q(".preloader__seed"), { scale: 0, duration: 0.6, ease: "seed" }, "<")
      .to(root.current, { clipPath: "inset(0 0 100% 0)", duration: 1.1, ease: "seed" }, "-=0.35");
    // Background tabs throttle rAF; never leave the page stuck behind the curtain.
    const safety = window.setTimeout(() => tl.progress(1), 6500);
    return () => {
      window.clearTimeout(safety);
      tl.kill();
    };
  }, []);

  if (done) return null;
  return (
    <div className="preloader" ref={root} aria-hidden>
      <div className="preloader__center">
        <SeedIcon className="preloader__seed" />
        <div className="preloader__word display">
          {"WIKISEED".split("").map((c, i) => (
            <span key={i}>{c}</span>
          ))}
        </div>
      </div>
      <div className="preloader__tag eyebrow muted">Intelligent contracts · GenLayer Studionet</div>
      <div className="preloader__count">000</div>
      <div className="preloader__bar" />
    </div>
  );
}
