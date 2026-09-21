export function isAnimationGalleryEnabled(environment = process.env.NODE_ENV): boolean {
  return environment !== "production";
}
