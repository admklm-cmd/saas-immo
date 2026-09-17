import { APP_TEXTS } from "@/components/texts";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Select, type SelectOption } from "@/components/ui/Select";
import { AGENT_LABELS, AGENT_ORDER, AGENT_RUN_STATUS_LABELS } from "@/lib/agents/messages";

const TEXTS = APP_TEXTS.runHistory;

const ALL = "";

const AGENT_OPTIONS: readonly SelectOption[] = [
  { value: ALL, label: TEXTS.filterAll },
  ...AGENT_ORDER.map((agent) => ({ value: agent, label: AGENT_LABELS[agent] })),
];

const STATUS_OPTIONS: readonly SelectOption[] = [
  { value: ALL, label: TEXTS.filterAll },
  ...(Object.keys(AGENT_RUN_STATUS_LABELS) as (keyof typeof AGENT_RUN_STATUS_LABELS)[]).map((status) => ({
    value: status,
    label: AGENT_RUN_STATUS_LABELS[status],
  })),
];

export type AgentRunsFiltersProps = {
  /** What the user asked for, kept as-is so the form never lies about itself. */
  selected: { agent: string; status: string };
};

/**
 * Filters of the execution history.
 *
 * A plain GET form: no client JavaScript, the filters live in the URL (so a
 * filtered history can be shared or reloaded), and the page re-reads them
 * server-side, where they are validated by zod.
 */
export function AgentRunsFilters({ selected }: AgentRunsFiltersProps) {
  return (
    <form
      method="get"
      action="/agents-ia"
      aria-label={TEXTS.filtersLabel}
      className="flex flex-wrap items-end gap-3"
    >
      <Select
        id="filter-agent"
        name="agent"
        label={TEXTS.filterAgent}
        options={AGENT_OPTIONS}
        defaultValue={selected.agent}
        className="w-44"
      />
      <Select
        id="filter-status"
        name="status"
        label={TEXTS.filterStatus}
        options={STATUS_OPTIONS}
        defaultValue={selected.status}
        className="w-44"
      />
      <Button type="submit" variant="secondary">
        {TEXTS.filterSubmit}
      </Button>
      {selected.agent || selected.status ? (
        <ButtonLink href="/agents-ia" variant="ghost">
          {TEXTS.filterReset}
        </ButtonLink>
      ) : null}
    </form>
  );
}
