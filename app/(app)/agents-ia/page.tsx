import type { Metadata } from "next";

import { APP_TEXTS } from "@/components/texts";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: `${APP_TEXTS.nav.agents} — ${APP_TEXTS.brand.name}` };

/** Shell (out of scope of this iteration): réglages des agents IA et coupe-circuit. */
export default function AgentsIaPage() {
  return (
    <ComingSoon
      title={APP_TEXTS.nav.agents}
      description={APP_TEXTS.shells.agents}
    />
  );
}
