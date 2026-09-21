import { notFound } from "next/navigation";

import { AnimationGallery } from "./AnimationGallery";
import { isAnimationGalleryEnabled } from "./guard";

export default function AnimationsPage() {
  if (!isAnimationGalleryEnabled()) notFound();
  return <AnimationGallery />;
}
