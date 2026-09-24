import { notFound } from "next/navigation";

import { isAnimationGalleryEnabled } from "../animations/guard";
import { IconGallery } from "./IconGallery";

/** Development gallery of the glyph family (404 in production, like /dev/particles). */
export default function IconsPage() {
  if (!isAnimationGalleryEnabled()) notFound();
  return <IconGallery />;
}
