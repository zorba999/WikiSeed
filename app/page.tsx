"use client";

import { BountyBoard, BountyDrawer } from "@/components/Bounties";
import { CreateBounty } from "@/components/CreateBounty";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Cursor, Magnetic, SmoothScroll } from "@/components/Motion";
import { Preloader } from "@/components/Preloader";
import { HowItWorks, Manifesto, Marquee } from "@/components/Sections";
import { AccountPanel, Toasts, WalletModal } from "@/components/Wallet";

export default function Home() {
  return (
    <>
      <SmoothScroll />
      <Magnetic />
      <Cursor />
      <Preloader />
      <Header />
      <main>
        <Hero />
        <Marquee />
        <Manifesto />
        <HowItWorks />
        <BountyBoard />
        <CreateBounty />
      </main>
      <Footer />
      <BountyDrawer />
      <AccountPanel />
      <WalletModal />
      <Toasts />
    </>
  );
}
