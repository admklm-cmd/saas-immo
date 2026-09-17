import { describe, expect, it } from "vitest";

import {
  decideLeadOutcome,
  hasEnoughToCreateContact,
  mergeIdentity,
  usableEmail,
  usablePhone,
} from "./decision";
import type { DuplicateMatch } from "./dedupe";
import type { LeaAcquisition } from "./schema";

/**
 * These rules are applied by the CODE, never by the AI: what the CRM is allowed
 * to receive, and what happens to a lead. The model only fills holes, and a
 * value the database would refuse becomes "missing", never "approximated".
 */

const EMPTY_EXTRACTION: LeaAcquisition = {
  first_name: null,
  last_name: null,
  email: null,
  phone: null,
  missing_fields: ["first_name", "last_name", "email", "phone"],
  confidence: 0.3,
  summary: "Rien d'exploitable.",
};

const FULL_EXTRACTION: LeaAcquisition = {
  first_name: "Aurélie",
  last_name: "Sorel",
  email: "aurelie.sorel@example.test",
  phone: "06 39 98 11 01",
  missing_fields: [],
  confidence: 0.9,
  summary: "Identité complète.",
};

const DUPLICATE: DuplicateMatch = {
  contactId: "11111111-1111-4111-8111-111111111111",
  matchedOn: ["email", "phone"],
  displayName: "Sophie Marchand",
};

describe("valeurs acceptables pour le CRM", () => {
  it("garde une adresse email que la base acceptera", () => {
    expect(usableEmail("aurelie.sorel@example.test")).toBe("aurelie.sorel@example.test");
    expect(usableEmail("  contact@example.test  ")).toBe("contact@example.test");
  });

  it("rejette une adresse que la base refuserait, sans la « réparer »", () => {
    for (const value of [null, "", "aurelie.sorel", "a b@example.test", `${"x".repeat(330)}@a.test`]) {
      expect(usableEmail(value), String(value)).toBeNull();
    }
  });

  it("garde un numéro écrit par un humain, en retirant le commentaire", () => {
    expect(usablePhone("06 39 98 11 01")).toBe("06 39 98 11 01");
    expect(usablePhone("+33 6 39 98 11 01")).toBe("+33 6 39 98 11 01");
    expect(usablePhone("06.39.98.11.01 (le soir)")).toBe("06.39.98.11.01");
  });

  it("rejette ce qui n'est pas un numéro", () => {
    for (const value of [null, "", "à rappeler", "12", "le soir de préférence"]) {
      expect(usablePhone(value), String(value)).toBeNull();
    }
  });
});

describe("mergeIdentity — le payload structuré gagne toujours", () => {
  it("prend les champs du formulaire et complète avec ce que le modèle a lu", () => {
    const identity = mergeIdentity(
      { first_name: "Aurélie", email: "aurelie.sorel@example.test" },
      { ...EMPTY_EXTRACTION, last_name: "Sorel", phone: "06 39 98 11 01" },
    );
    expect(identity).toMatchObject({
      firstName: "Aurélie",
      lastName: "Sorel",
      email: "aurelie.sorel@example.test",
      phone: "06 39 98 11 01",
    });
    expect(identity.fromPayload.sort()).toEqual(["email", "first_name"]);
    expect(identity.missingFields).toEqual([]);
  });

  it("n'écrase jamais une valeur du payload par celle du modèle", () => {
    const identity = mergeIdentity(
      { email: "vrai.contact@example.test" },
      { ...FULL_EXTRACTION, email: "adresse.inventee@example.test" },
    );
    expect(identity.email).toBe("vrai.contact@example.test");
  });

  it("signale comme manquant ce que personne n'a fourni", () => {
    const identity = mergeIdentity({}, EMPTY_EXTRACTION);
    expect(identity.missingFields.sort()).toEqual(["email", "first_name", "last_name", "phone"]);
    expect(identity.fromPayload).toEqual([]);
  });

  it("une valeur inexploitable devient « manquante », jamais approximée", () => {
    const identity = mergeIdentity(
      { email: "pas-une-adresse", phone: "à rappeler" },
      EMPTY_EXTRACTION,
    );
    expect(identity.email).toBeNull();
    expect(identity.phone).toBeNull();
    expect(identity.missingFields).toContain("email");
    expect(identity.missingFields).toContain("phone");
    // Ce qui a été refusé n'est pas présenté comme venant du formulaire.
    expect(identity.fromPayload).toEqual([]);
  });

  it("ignore un payload qui n'est pas du texte (valeur forgée)", () => {
    const identity = mergeIdentity(
      { first_name: { $ne: null }, email: ["a@b.test"], phone: 33639981101 },
      EMPTY_EXTRACTION,
    );
    expect(identity.firstName).toBeNull();
    expect(identity.email).toBeNull();
    expect(identity.phone).toBeNull();
  });
});

describe("hasEnoughToCreateContact", () => {
  it("exige un nom ET un moyen de joindre la personne", () => {
    const base = { missingFields: [], fromPayload: [] };
    expect(
      hasEnoughToCreateContact({
        ...base,
        firstName: "Aurélie",
        lastName: null,
        email: "a@example.test",
        phone: null,
      }),
    ).toBe(true);
    expect(
      hasEnoughToCreateContact({
        ...base,
        firstName: null,
        lastName: "Sorel",
        email: null,
        phone: "0639981101",
      }),
    ).toBe(true);
    // Un nom sans coordonnées : fiche fantôme, refusée.
    expect(
      hasEnoughToCreateContact({
        ...base,
        firstName: "Aurélie",
        lastName: "Sorel",
        email: null,
        phone: null,
      }),
    ).toBe(false);
    // Des coordonnées sans nom : refusé aussi.
    expect(
      hasEnoughToCreateContact({
        ...base,
        firstName: null,
        lastName: null,
        email: "a@example.test",
        phone: null,
      }),
    ).toBe(false);
  });
});

describe("decideLeadOutcome", () => {
  it("un doublon exact l'emporte toujours : aucune seconde fiche", () => {
    const identity = mergeIdentity({}, FULL_EXTRACTION);
    const decision = decideLeadOutcome({ identity, duplicate: DUPLICATE });
    expect(decision.outcome).toBe("duplicate_found");
    expect(decision.leadStatus).toBe("duplicate");
    expect(decision.duplicate?.contactId).toBe(DUPLICATE.contactId);
  });

  it("un lead complet et sans doublon donne une fiche", () => {
    const identity = mergeIdentity({}, FULL_EXTRACTION);
    const decision = decideLeadOutcome({ identity, duplicate: null });
    expect(decision.outcome).toBe("contact_created");
    expect(decision.leadStatus).toBe("processed");
  });

  it("un lead trop mince ne crée rien et reste à traiter", () => {
    const identity = mergeIdentity({}, EMPTY_EXTRACTION);
    const decision = decideLeadOutcome({ identity, duplicate: null });
    expect(decision.outcome).toBe("incomplete");
    expect(decision.leadStatus).toBe("pending");
    expect(decision.duplicate).toBeNull();
  });
});
