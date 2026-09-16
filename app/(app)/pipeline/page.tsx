import type { Metadata } from "next";

import { APP_TEXTS } from "@/components/texts";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: `${APP_TEXTS.nav.pipeline} — ${APP_TEXTS.brand.name}` };

/** Shell (out of scope of this iteration). */
export default function PipelinePage() {
  return (
    <ComingSoon
      title={APP_TEXTS.nav.pipeline}
      description={APP_TEXTS.shells.pipeline}
    />
  );
}
