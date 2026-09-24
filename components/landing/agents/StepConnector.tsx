import styles from "./agents.module.css";

/**
 * Piece of the flow line between two modules (the order of the dossier). Lit
 * when the flow has already passed it. Decorative (`aria-hidden`): the order
 * of the tabs already says it.
 */
export function StepConnector({ lit }: { lit: boolean }) {
  return <span aria-hidden="true" data-testid="step-connector" data-lit={lit || undefined} className={styles.connector} />;
}
