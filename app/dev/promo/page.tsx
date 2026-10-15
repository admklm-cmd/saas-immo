import { notFound } from "next/navigation";

import { isPromoEnabled } from "./guard";
import { PromoStage } from "./PromoStage";
import { loadPromoDemo } from "./promo-demo";
import { parseFormat } from "./promo-format";
import { DURATION_MS } from "./promo-timeline";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Promo video of Ascend Strategy (docs/motion/promo-2026-10.md): development tool, 404 in production.
 * `?format=16x9|9x16`, `?t=<ms>` (fixed position, used by the export), `?still=poster` (last image).
 */
export default async function PromoPage({ searchParams }: { searchParams: SearchParams }) {
  if (!isPromoEnabled()) notFound();
  const params = await searchParams;
  const format = parseFormat(first(params.format));
  const rawTime = first(params.t);
  const parsed = rawTime === undefined ? NaN : Number(rawTime);
  const fixedTime = first(params.still) === "poster" ? DURATION_MS : Number.isFinite(parsed) ? Math.min(DURATION_MS, Math.max(0, parsed)) : null;
  const demo = loadPromoDemo();
  return (
    <>
      {/* The Next.js development badge must never end up in a frame. */}
      <style>{"nextjs-portal{display:none !important}"}</style>
      <PromoStage format={format} fixedTime={fixedTime} demo={demo} />
    </>
  );
}
