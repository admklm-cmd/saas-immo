import { notFound } from "next/navigation";
import { isAnimationGalleryEnabled } from "../animations/guard";
import { ParticleGallery } from "./ParticleGallery";

export default function ParticlePreviewPage() {
  if (!isAnimationGalleryEnabled()) notFound();
  return <ParticleGallery />;
}
