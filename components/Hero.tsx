"use client";

import { useEffect, useRef } from "react";
import { useStats } from "@/hooks/useWikiSeed";
import { gen } from "@/lib/format";
import { gsap, reduceMotion, SplitText } from "@/lib/gsap";
import { onReady } from "./Preloader";

const RING =
  "ⵜⴰⵎⴰⵣⵉⵖⵜ · FØROYSKT · RUNA SIMI · WOLOF · GÀIDHLIG · AVAÑE'Ẽ · TE REO MĀORI · KALAALLISUT · ʻŌLELO HAWAIʻI · BREZHONEG · ";

function CountUp({ value, digits = 0 }: { value: number; digits?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  useEffect(() => {
    const o = { v: prev.current };
    const t = gsap.to(o, {
      v: value,
      duration: 1.6,
      ease: "power3.out",
      onUpdate: () => {
        if (ref.current) ref.current.textContent = o.v.toLocaleString("en-US", { maximumFractionDigits: digits });
      },
    });
    prev.current = value;
    return () => {
      t.kill();
    };
  }, [value, digits]);
  return <span ref={ref}>0</span>;
}

export function Hero() {
  const root = useRef<HTMLElement>(null);
  const { data: stats } = useStats();

  useEffect(() => {
    const q = gsap.utils.selector(root);
    let split: SplitText | null = null;
    const ctx = gsap.context(() => {
      gsap.to(q(".hero__ring-rot"), { rotate: 360, duration: 90, ease: "none", repeat: -1, transformOrigin: "50% 50%" });
      if (reduceMotion()) return;
      split = SplitText.create(q(".hero__title .hl"), { type: "chars,lines", mask: "lines" });
      gsap.set(split.chars, { yPercent: 115 });
      gsap.set(q(".hero-fade"), { opacity: 0, y: 24 });
      gsap.set(q(".hero__ring"), { opacity: 0, scale: 0.85 });

      // scroll parallax
      gsap.to(q(".hero__title"), {
        yPercent: -18,
        ease: "none",
        scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
      });
      gsap.to(q(".hero__ring-scroll"), {
        rotate: -120,
        ease: "none",
        scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
      });
    }, root);

    const off = onReady(() => {
      if (!split) return;
      const tl = gsap.timeline();
      tl.to(split.chars, { yPercent: 0, duration: 1.4, ease: "seed", stagger: 0.022 })
        .to(q(".hero__ring"), { opacity: 0.9, scale: 1, duration: 2, ease: "bloom" }, 0.2)
        .to(q(".hero-fade"), { opacity: 1, y: 0, duration: 1.1, ease: "bloom", stagger: 0.08 }, 0.6);
    });
    return () => {
      off();
      ctx.revert();
      split?.revert();
    };
  }, []);

  const open = stats?.by_status?.OPEN ?? 0;
  return (
    <section className="hero" ref={root} id="top">
      <div className="hero__meta hero-fade">
        <span className="eyebrow">Prologue — N°00</span>
        <span className="eyebrow muted">Bounties for small-language Wikipedias</span>
        <span className="eyebrow">Judged by AI validators · Paid on-chain</span>
      </div>

      <div className="hero__body">
        <svg className="hero__ring" viewBox="0 0 600 600" aria-hidden>
          <g className="hero__ring-scroll" style={{ transformOrigin: "300px 300px" }}>
            <g className="hero__ring-rot" style={{ transformOrigin: "300px 300px" }}>
              <defs>
                <path id="ring" d="M300,300 m-250,0 a250,250 0 1,1 500,0 a250,250 0 1,1 -500,0" />
                <path id="ring2" d="M300,300 m-190,0 a190,190 0 1,1 380,0 a190,190 0 1,1 -380,0" />
              </defs>
              <text>
                <textPath href="#ring">{RING + RING}</textPath>
              </text>
              <text style={{ fontSize: 12, opacity: 0.7 }}>
                <textPath href="#ring2">
                  {"gl.nondet.web.get · gl.nondet.exec_prompt · run_nondet_unsafe · optimistic democracy · appeal · "}
                </textPath>
              </text>
            </g>
          </g>
          <circle cx="300" cy="300" r="130" fill="none" stroke="rgba(168,148,116,.35)" />
          <g transform="translate(300 300)" fill="#A89474">
            <path d="M0 70V-10" stroke="#A89474" strokeWidth="3" strokeLinecap="round" />
            <path d="M0 10c-28 0-44-19-44-44 28 0 44 19 44 44Z" />
            <path d="M0-2c0-25 16-44 44-44 0 25-16 44-44 44Z" fill="#EFE8DC" />
          </g>
        </svg>

        <h1 className="sr-only">WikiSeed — where small languages grow</h1>
        <div className="hero__title display" aria-hidden>
          <div className="hl">Where</div>
          <div className="hero__row2">
            <div className="hl">
              <span className="serif">small</span> languages
            </div>
          </div>
          <div className="hero__row2">
            <div className="hl">grow.</div>
            <p className="hero__lede hero-fade">
              Sponsors seed GEN on an article that is missing in Faroese, Wolof, Quechua or Tamazight. Writers grow it. GenLayer&apos;s
              validators read Wikipedia themselves and decide.
            </p>
          </div>
        </div>
      </div>

      <div className="hero__foot">
        <div className="hero-fade">
          <div className="stat__num">
            <CountUp value={open} />
          </div>
          <div className="stat__label eyebrow muted">Open bounties</div>
        </div>
        <div className="hero-fade">
          <div className="stat__num">
            <CountUp value={Number(gen(stats?.total_locked ?? "0").replace(/,/g, ""))} digits={1} />
            <small>GEN</small>
          </div>
          <div className="stat__label eyebrow muted">Seeded &amp; locked</div>
        </div>
        <div className="hero-fade">
          <div className="stat__num">
            <CountUp value={Number(gen(stats?.total_paid ?? "0").replace(/,/g, ""))} digits={1} />
            <small>GEN</small>
          </div>
          <div className="stat__label eyebrow muted">Harvested by writers</div>
        </div>
        <div className="hero-fade">
          <div className="stat__num">
            <CountUp value={stats?.wikis ?? 0} />
          </div>
          <div className="stat__label eyebrow muted">Wikipedias reached</div>
        </div>
        <div className="hero__cta hero-fade">
          <a href="#bounties" className="btn btn--light" data-magnetic data-cursor="Go">
            Explore bounties <span className="arrow">→</span>
          </a>
          <a href="#seed" className="btn btn--ghost" data-magnetic>
            Seed one
          </a>
        </div>
      </div>
      <div className="scroll-cue" aria-hidden />
    </section>
  );
}
