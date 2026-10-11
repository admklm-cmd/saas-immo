import { notFound } from "next/navigation";

import { PARTICLE_PRESETS, type ParticlePreset } from "@/components/motion/shapes";

import { isAnimationGalleryEnabled } from "../animations/guard";
import { BackgroundPreview } from "./BackgroundPreview";
import { ParticleGallery } from "./ParticleGallery";

function isPreset(value: unknown): value is ParticlePreset {
  return typeof value === "string" && (PARTICLE_PRESETS as readonly string[]).includes(value);
}

export default async function ParticlesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!isAnimationGalleryEnabled()) notFound();
  const { only, fond } = await searchParams;
  if (isPreset(fond)) return <BackgroundPreview initial={fond} />;
  return <ParticleGallery only={isPreset(only) ? only : null} />;
}
