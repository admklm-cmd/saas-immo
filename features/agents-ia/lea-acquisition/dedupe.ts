/**
 * Léa — acquisition: DEDUPLICATION. Pure code, no database, no AI call.
 *
 * NON-NEGOTIABLE DESIGN RULE. The AI never decides whether two people are the
 * same person. A model that "thinks" two records look alike would eventually
 * merge two different sellers — two different families, two different mandates,
 * two different sets of personal data. That is a serious fault, not a UX
 * detail. So the match here is DETERMINISTIC and EXACT, on normalised values:
 *
 *   * email: trimmed, lower-cased. Nothing else — no alias stripping, no
 *     `+tag` removal, no dotted-local-part folding: those are provider-specific
 *     conventions and `a.b@x` is NOT guaranteed to be `ab@x`.
 *   * phone: digits only, in French national form. `06 39 98 10 03`,
 *     `+33 6 39 98 10 03` and `0033639981003` are the same line; anything else
 *     is kept as its digit string and compared as such.
 *
 * A name is deliberately NOT a matching key: two "Martin" in La Ciotat are two
 * different sellers. It is only used to describe the match to a human.
 *
 * When nothing matches exactly, there is no duplicate — full stop. A "likely"
 * duplicate is not a duplicate; a human will see both records and decide.
 */

/** Normalised e-mail, or `null` when there is nothing usable. */
export function normaliseEmail(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim().toLowerCase();
  if (trimmed.length === 0) return null;
  // Not a validation: just "is there a local part and a domain part".
  if (!/^[^@\s]+@[^@\s]+$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Normalised phone number: digits only, French numbers in national form.
 * `null` when there are not enough digits to identify a line.
 */
export function normalisePhone(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (raw.length === 0) return null;

  let digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return null;

  // International spellings of a French number -> national form (0X XX XX XX XX).
  if (digits.startsWith("0033")) digits = `0${digits.slice(4)}`;
  else if (raw.startsWith("+33")) digits = `0${digits.slice(2)}`;
  else if (digits.length === 11 && digits.startsWith("33")) digits = `0${digits.slice(2)}`;

  // Too short to be a line: treat it as unusable rather than as a weak key.
  return digits.length >= 6 ? digits : null;
}

/** Identity of a lead or of an existing contact, as the code compares them. */
export type ContactIdentity = {
  email: string | null;
  phone: string | null;
};

export type ExistingContact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

/** What made two records the same person. Displayed to the human, never guessed. */
export type DuplicateMatchKey = "email" | "phone";

export type DuplicateMatch = {
  contactId: string;
  /** Every key that matched exactly, in a stable order. */
  matchedOn: DuplicateMatchKey[];
  /** Name of the existing contact, for the task and the history entry. */
  displayName: string;
};

export function contactDisplayName(contact: ExistingContact): string {
  const name = [contact.first_name, contact.last_name]
    .map((part) => (part ?? "").trim())
    .filter((part) => part.length > 0)
    .join(" ");
  return name.length > 0 ? name : "contact sans nom";
}

/**
 * Finds THE existing contact that is exactly the same person, or `null`.
 *
 * Ordering rule, so the result never depends on the order rows came back in:
 * an email + phone match wins over an email match, which wins over a phone
 * match; ties are broken by contact id. If two different contacts match on
 * different keys (one on the email, another on the phone), that is an
 * inconsistency in the CRM, not a decision for an agent: the strongest match is
 * returned and both are visible to the human through `candidates`.
 */
export function findDuplicate(
  identity: ContactIdentity,
  contacts: readonly ExistingContact[],
): DuplicateMatch | null {
  const email = normaliseEmail(identity.email);
  const phone = normalisePhone(identity.phone);
  if (email === null && phone === null) return null;

  const matches: DuplicateMatch[] = [];
  for (const contact of contacts) {
    const matchedOn: DuplicateMatchKey[] = [];
    if (email !== null && normaliseEmail(contact.email) === email) matchedOn.push("email");
    if (phone !== null && normalisePhone(contact.phone) === phone) matchedOn.push("phone");
    if (matchedOn.length > 0) {
      matches.push({ contactId: contact.id, matchedOn, displayName: contactDisplayName(contact) });
    }
  }

  if (matches.length === 0) return null;

  matches.sort((left, right) => {
    if (right.matchedOn.length !== left.matchedOn.length) {
      return right.matchedOn.length - left.matchedOn.length;
    }
    // Email is the stronger single key (a phone can be shared by a household).
    const leftEmail = left.matchedOn.includes("email") ? 0 : 1;
    const rightEmail = right.matchedOn.includes("email") ? 0 : 1;
    if (leftEmail !== rightEmail) return leftEmail - rightEmail;
    return left.contactId.localeCompare(right.contactId);
  });

  return matches[0]!;
}

/** French description of what matched, for the task and the CRM history. */
export const MATCH_KEY_LABELS: Readonly<Record<DuplicateMatchKey, string>> = {
  email: "même adresse email",
  phone: "même numéro de téléphone",
};

export function describeMatch(match: DuplicateMatch): string {
  const keys = match.matchedOn.map((key) => MATCH_KEY_LABELS[key]).join(" et ");
  return `${match.displayName} — ${keys}`;
}
