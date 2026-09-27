"use client";

import { useEffect, useRef } from "react";
import { gsap, reduceMotion, ScrollTrigger } from "@/lib/gsap";
import { FadeUp, Reveal, SeedIcon } from "./Motion";

/* ───────── marquee: velocity-reactive ───────── */

const WORDS: [string, boolean][] = [
  ["Føroyskt", false],
  ["ⵜⴰⵎⴰⵣⵉⵖⵜ", true],
  ["Runa Simi", false],
  ["Wolof", true],
  ["Gàidhlig", false],
  ["Avañe'ẽ", true],
  ["Te Reo Māori", false],
  ["Kalaallisut", true],
];

export function Marquee() {
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!track.current) return;
    const half = track.current.scrollWidth / 2;
    const tween = gsap.to(track.current, { x: -half, duration: 38, ease: "none", repeat: -1 });
    if (reduceMotion()) {
      tween.pause();
      return;
    }
    let dir = 1;
    const st = ScrollTrigger.create({
      onUpdate: (self) => {
        const v = self.getVelocity() / 300;
        dir = self.direction;
        gsap.to(tween, { timeScale: dir * Math.min(6, 1 + Math.abs(v)), duration: 0.2, overwrite: true });
        gsap.to(tween, { timeScale: dir, duration: 1.4, delay: 0.25, ease: "power2.out" });
      },
    });
    return () => {
      tween.kill();
      st.kill();
    };
  }, []);

  const row = WORDS.map(([w, s], i) => (
    <span className="marquee__item" key={i}>
      <span className={s ? "serif" : ""}>{w}</span>
      <SeedIcon />
    </span>
  ));
  return (
    <div className="marquee" aria-hidden>
      <div className="marquee__track" ref={track}>
        {row}
        {row}
      </div>
    </div>
  );
}

/* ───────── manifesto: scroll-scrubbed word reveal ───────── */

const MANIFESTO =
  "There are about seven thousand living languages and roughly three hundred and forty Wikipedias. English alone holds millions of articles. Faroese, Wolof, Quechua and Tamazight hold a sliver of that. People who care will pay to close the gap — they just could not tell whether an article was *real work* in a language they do not read. Now *validators can*.";

export function Manifesto() {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const q = gsap.utils.selector(root);
    const ctx = gsap.context(() => {
      if (reduceMotion()) {
        gsap.set(q(".w"), { opacity: 1 });
        gsap.set(q(".glyph-card"), { clipPath: "inset(0% 0 0 0)" });
        return;
      }
      gsap.to(q(".w"), {
        opacity: 1,
        stagger: 0.1,
        ease: "none",
        scrollTrigger: { trigger: q(".manifesto__text")[0], start: "top 75%", end: "bottom 45%", scrub: true },
      });
      q(".glyph-card").forEach((card: Element, i: number) => {
        gsap.to(card, {
          clipPath: "inset(0% 0 0 0)",
          duration: 1.4,
          delay: i * 0.12,
          ease: "seed",
          scrollTrigger: { trigger: card, start: "top 88%" },
        });
        gsap.fromTo(
          card.querySelector(".glyph-card__big"),
          { yPercent: 18 },
          { yPercent: -18, ease: "none", scrollTrigger: { trigger: card, start: "top bottom", end: "bottom top", scrub: true } },
        );
      });
    }, root);
    return () => ctx.revert();
  }, []);

  const words = MANIFESTO.split(" ");
  let em = false;
  return (
    <section className="section manifesto" id="why" ref={root}>
      <div className="manifesto__grid">
        <div>
          <div className="chapter-label eyebrow">01 — Why</div>
          <div className="facts">
            <FadeUp className="fact">
              <div className="fact__num">~7,000</div>
              <div className="eyebrow muted">living languages</div>
            </FadeUp>
            <FadeUp className="fact" delay={0.1}>
              <div className="fact__num">~340</div>
              <div className="eyebrow muted">Wikipedia editions</div>
            </FadeUp>
            <FadeUp className="fact" delay={0.2}>
              <div className="fact__num">0</div>
              <div className="eyebrow muted">human moderators in the loop</div>
            </FadeUp>
          </div>
        </div>
        <p className="manifesto__text">
          {words.map((w, i) => {
            const start = w.startsWith("*");
            if (start) em = true;
            const clean = w.replace(/\*/g, "");
            const node = em ? (
              <em key={i} className="w">
                {clean}{" "}
              </em>
            ) : (
              <span key={i} className="w">
                {clean}{" "}
              </span>
            );
            if (w.endsWith("*") || w.endsWith("*.")) em = false;
            return node;
          })}
        </p>
      </div>
      <div className="manifesto__visual" aria-hidden>
        <div className="glyph-card">
          <span className="glyph-card__big">ⵣ</span>
          <div className="glyph-card__cap eyebrow">
            <span>Tamazight</span>
            <span>zgh</span>
          </div>
        </div>
        <div className="glyph-card">
          <span className="glyph-card__big">Ø</span>
          <div className="glyph-card__cap eyebrow">
            <span>Føroyskt</span>
            <span>fo</span>
          </div>
        </div>
        <div className="glyph-card">
          <span className="glyph-card__big">Ñ</span>
          <div className="glyph-card__cap eyebrow">
            <span>Runa Simi</span>
            <span>qu</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────── how it works: pinned horizontal chapters ───────── */

const CHAPTERS = [
  {
    t: "Seed",
    b: "A sponsor locks GEN on a missing article: a Wikipedia language, a topic, a minimum length, required sources and a survival window.",
    tech: ["@gl.public.write.payable", "gl.message.value"],
  },
  {
    t: "Root",
    b: "A writer proves they own a Wikipedia account by pasting their wallet address on their User page. Validators fetch that page and check who saved it.",
    tech: ["gl.nondet.web.get", "strict_eq"],
  },
  {
    t: "Grow",
    b: "The writer publishes the article and claims with its revision id. Validators pull that exact revision through the MediaWiki API and recount words, references and authorship.",
    tech: ["MediaWiki API", "deterministic facts"],
  },
  {
    t: "Judge",
    b: "Each validator asks its own LLM: is this really Faroese? On topic? Machine-translated? Are the sources real? They agree on the verdict, not on the wording.",
    tech: ["gl.nondet.exec_prompt", "run_nondet_unsafe", "tolerance band"],
  },
  {
    t: "Harvest",
    b: "After the survival window, anyone can finalize. If the article still stands on Wikipedia, the reward is released to the writer. If it was deleted, the bounty reopens.",
    tech: ["Optimistic Democracy", "appeals", "withdraw()"],
  },
];

export function HowItWorks() {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const q = gsap.utils.selector(root);
    const mm = gsap.matchMedia();
    mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
      const track = q(".chapters__track")[0] as HTMLElement;
      const distance = () => track.scrollWidth - window.innerWidth;
      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: q(".chapters__pin")[0],
          start: "top top",
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 0.8,
          invalidateOnRefresh: true,
        },
      });
      gsap.to(q(".chapters__progress i"), {
        scaleX: 1,
        ease: "none",
        scrollTrigger: { trigger: q(".chapters__pin")[0], start: "top top", end: () => `+=${distance()}`, scrub: true },
      });
      q(".chapter").forEach((c: Element) => {
        const num = c.querySelector(".chapter__num");
        if (num)
          gsap.from(num, {
            yPercent: 60,
            opacity: 0,
            ease: "bloom",
            duration: 1,
            scrollTrigger: { trigger: c, containerAnimation: tween, start: "left 85%" },
          });
      });
    });
    mm.add("(max-width: 767px)", () => {
      q(".chapter").forEach((c: Element) =>
        gsap.from(c, { y: 50, opacity: 0, duration: 1, ease: "bloom", scrollTrigger: { trigger: c, start: "top 90%" } }),
      );
    });
    return () => mm.revert();
  }, []);

  return (
    <section className="chapters" id="how" ref={root} style={{ position: "relative" }}>
      <div className="chapters__intro section-head" style={{ marginBottom: 0 }}>
        <div>
          <div className="chapter-label eyebrow">02 — How it works</div>
          <Reveal as="h2" className="section-head__title display">
            Five seasons of a bounty
          </Reveal>
        </div>
        <p className="section-head__aside" style={{ color: "rgba(239,232,220,.72)" }}>
          No moderators, no oracle, no trust in the sponsor or the writer. Every step is an Intelligent Contract call that GenLayer
          validators execute and agree on.
        </p>
      </div>
      <div className="chapters__pin">
        <div className="chapters__track">
          {CHAPTERS.map((c, i) => (
            <article className="chapter" key={c.t}>
              <div className="chapter__num">0{i + 1}</div>
              <div>
                <h3 className="chapter__title display">{c.t}</h3>
                <p className="chapter__body">{c.b}</p>
              </div>
              <div className="chapter__tech">
                {c.tech.map((t) => (
                  <span className="tag mono" key={t}>
                    {t}
                  </span>
                ))}
              </div>
            </article>
          ))}
          <article className="chapter chapter--end">
            <div>
              <SeedIcon className="preloader__seed" />
              <p className="d-title" style={{ margin: "18px 0 26px" }}>
                Ready to plant
                <br />
                the first seed?
              </p>
              <a href="#bounties" className="btn" data-magnetic>
                See open bounties <span className="arrow">→</span>
              </a>
            </div>
          </article>
        </div>
        <div className="chapters__progress">
          <i />
        </div>
      </div>
    </section>
  );
}

