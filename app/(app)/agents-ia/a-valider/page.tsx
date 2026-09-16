import type { Metadata } from "next";

import { APP_TEXTS } from "@/components/texts";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = {
  title: `${APP_TEXTS.nav.agentsToValidate} — ${APP_TEXTS.brand.name}`,
};

/** Shell (out of scope of this iteration): file d'attente des premiers contacts. */
export default function MessagesToValidatePage() {
  return (
    <ComingSoon
      title={APP_TEXTS.nav.agentsToValidate}
      description={APP_TEXTS.shells.agentsToValidate}
    />
  );
}
