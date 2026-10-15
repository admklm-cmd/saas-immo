/** The promo video page is a development tool: it answers 404 in production. */
export function isPromoEnabled(environment = process.env.NODE_ENV): boolean {
  return environment !== "production";
}
