export function gen(wei: string | bigint | number | undefined, digits = 2) {
  if (wei === undefined) return "0";
  const v = BigInt(wei.toString());
  const whole = v / 10n ** 18n;
  const frac = Number(v % 10n ** 18n) / 1e18;
  const n = Number(whole) + frac;
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export function timeLeft(unix: number) {
  const s = unix - Math.floor(Date.now() / 1000);
  if (s <= 0) return "ended";
  const d = Math.floor(s / 86400);
  if (d >= 1) return `${d}d left`;
  const h = Math.floor(s / 3600);
  if (h >= 1) return `${h}h left`;
  return `${Math.max(1, Math.floor(s / 60))}m left`;
}

export function ago(unix: number) {
  const s = Math.floor(Date.now() / 1000) - unix;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const wikiHost = (wiki: string) => `https://${wiki}.wikipedia.org`;
export const revUrl = (wiki: string, revid: number) => `${wikiHost(wiki)}/w/index.php?oldid=${revid}`;

/** Endonyms shown next to wiki codes, for flavour. */
export const NATIVE: Record<string, string> = {
  fo: "Føroyskt",
  wo: "Wolof",
  qu: "Runa Simi",
  zgh: "ⵜⴰⵎⴰⵣⵉⵖⵜ",
  kab: "Taqbaylit",
  gd: "Gàidhlig",
  test: "Test wiki",
  ln: "Lingála",
  sm: "Gagana Samoa",
  gn: "Avañe'ẽ",
  ay: "Aymar aru",
  mi: "Te Reo Māori",
  se: "Davvisámegiella",
  haw: "ʻŌlelo Hawaiʻi",
  br: "Brezhoneg",
  kl: "Kalaallisut",
  tt: "Татарча",
  dv: "ދިވެހި",
  bo: "བོད་ཡིག",
  ary: "الدارجة",
};

export const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  APPROVED: "In survival window",
  PAID: "Harvested",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};
