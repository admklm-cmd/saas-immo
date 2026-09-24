import type { ComponentType } from "react";
import {
  ArchiveIcon,
  CheckCircledIcon,
  CodeIcon,
  FileTextIcon,
  LockClosedIcon,
  MagicWandIcon,
  TargetIcon,
} from "@radix-ui/react-icons";

import type { AgentRunPhase } from "@/lib/agents/steps";

type IconComponent = ComponentType<{ className?: string; width?: number; height?: number }>;

/**
 * One Radix icon per recorded phase. Shared by the full process track of the
 * replay and by the compact preview listed on « Agents IA », so a phase reads
 * the same everywhere.
 */
export const PHASE_ICONS: Readonly<Record<AgentRunPhase, IconComponent>> = {
  guardrails: LockClosedIcon,
  context_loaded: FileTextIcon,
  prompt_built: CodeIcon,
  ai_call: MagicWandIcon,
  output_validated: CheckCircledIcon,
  decision: TargetIcon,
  persisted: ArchiveIcon,
};
