/**
 * Arrow between two cards of the carousel: the order of the dossier.
 * Decorative (`aria-hidden`): the order of the tabs already says it.
 */
export function StepConnector() {
  return (
    <span aria-hidden="true" data-testid="step-connector" className="flex w-9 shrink-0 items-center self-center sm:w-11">
      <svg viewBox="0 0 44 12" className="w-full text-ink-subtle" fill="none">
        <path d="M2 6 H38" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="1 5" />
        <path d="M34 2 L40 6 L34 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
