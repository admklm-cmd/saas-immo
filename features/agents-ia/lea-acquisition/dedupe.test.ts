import { describe, expect, it } from "vitest";

import {
  contactDisplayName,
  describeMatch,
  findDuplicate,
  normaliseEmail,
  normalisePhone,
  type ExistingContact,
} from "./dedupe";

/**
 * Deduplication is done BY THE CODE, on exact matches of normalised values.
 * The two failures that matter are opposite and both serious:
 *   * missing an obvious duplicate  -> two records for the same seller;
 *   * merging two different people  -> two families in one file.
 * These tests pin both.
 */

const SOPHIE: ExistingContact = {
  id: "11111111-1111-4111-8111-111111111111",
  first_name: "Sophie",
  last_name: "Marchand",
  email: "sophie.marchand@example.test",
  phone: "06 39 98 10 03",
};

const AUTRE_SOPHIE: ExistingContact = {
  id: "22222222-2222-4222-8222-222222222222",
  first_name: "Sophie",
  last_name: "Marchand",
  email: "s.marchand@example.test",
  phone: "06 39 98 10 04",
};

const SANS_COORDONNEES: ExistingContact = {
  id: "33333333-3333-4333-8333-333333333333",
  first_name: "Jean",
  last_name: null,
  email: null,
  phone: null,
};

const CONTACTS = [SOPHIE, AUTRE_SOPHIE, SANS_COORDONNEES];

describe("normalisation de l'email", () => {
  it("met en minuscules et retire les espaces autour", () => {
    expect(normaliseEmail("  Sophie.Marchand@Example.TEST ")).toBe("sophie.marchand@example.test");
  });

  it("refuse ce qui n'est pas une adresse", () => {
    for (const value of [null, undefined, "", "   ", "sophie.marchand", "a b@c", "@example.test"]) {
      expect(normaliseEmail(value), String(value)).toBeNull();
    }
  });

  it("ne « devine » aucune équivalence propriétaire", () => {
    // `a.b@x` et `ab@x` ne sont PAS la même adresse en général : les retirer
    // reviendrait à fusionner deux personnes différentes.
    expect(normaliseEmail("a.b@example.test")).not.toBe(normaliseEmail("ab@example.test"));
    expect(normaliseEmail("sophie+vente@example.test")).not.toBe(
      normaliseEmail("sophie@example.test"),
    );
  });
});

describe("normalisation du téléphone", () => {
  it("ramène les écritures internationales à la forme nationale", () => {
    const expected = "0639981003";
    expect(normalisePhone("06 39 98 10 03")).toBe(expected);
    expect(normalisePhone("06.39.98.10.03")).toBe(expected);
    expect(normalisePhone("+33 6 39 98 10 03")).toBe(expected);
    expect(normalisePhone("0033639981003")).toBe(expected);
    expect(normalisePhone("(06) 39-98-10-03")).toBe(expected);
  });

  it("refuse ce qui est trop court ou vide", () => {
    for (const value of [null, undefined, "", "  ", "12345", "abcd"]) {
      expect(normalisePhone(value), String(value)).toBeNull();
    }
  });

  it("ne confond pas deux numéros différents", () => {
    expect(normalisePhone("06 39 98 10 03")).not.toBe(normalisePhone("06 39 98 10 04"));
  });
});

describe("findDuplicate — doublon évident", () => {
  it("reconnaît le même email ET le même téléphone, écrits autrement", () => {
    const match = findDuplicate(
      { email: "SOPHIE.MARCHAND@example.test", phone: "+33 6 39 98 10 03" },
      CONTACTS,
    );
    expect(match?.contactId).toBe(SOPHIE.id);
    expect(match?.matchedOn).toEqual(["email", "phone"]);
    expect(describeMatch(match!)).toContain("même adresse email");
  });

  it("reconnaît un doublon sur le seul email", () => {
    const match = findDuplicate({ email: "sophie.marchand@example.test", phone: null }, CONTACTS);
    expect(match?.contactId).toBe(SOPHIE.id);
    expect(match?.matchedOn).toEqual(["email"]);
  });

  it("reconnaît un doublon sur le seul téléphone", () => {
    const match = findDuplicate({ email: null, phone: "0639981003" }, CONTACTS);
    expect(match?.contactId).toBe(SOPHIE.id);
    expect(match?.matchedOn).toEqual(["phone"]);
  });
});

describe("findDuplicate — faux jumeaux : rien ne doit être fusionné", () => {
  it("deux homonymes avec des coordonnées différentes ne sont pas un doublon", () => {
    expect(
      findDuplicate({ email: "sophie.marchand2@example.test", phone: "06 39 98 10 09" }, CONTACTS),
    ).toBeNull();
  });

  it("le seul nom ne suffit jamais : sans email ni téléphone, aucun doublon", () => {
    expect(findDuplicate({ email: null, phone: null }, CONTACTS)).toBeNull();
    expect(findDuplicate({ email: "   ", phone: "12" }, CONTACTS)).toBeNull();
  });

  it("une adresse proche mais différente n'est pas un doublon", () => {
    expect(findDuplicate({ email: "s.marchand2@example.test", phone: null }, CONTACTS)).toBeNull();
  });

  it("un contact sans coordonnées ne peut jamais être un doublon", () => {
    expect(findDuplicate({ email: null, phone: "0639981003" }, [SANS_COORDONNEES])).toBeNull();
  });
});

describe("findDuplicate — déterminisme", () => {
  it("le résultat ne dépend pas de l'ordre des fiches", () => {
    const identity = { email: "sophie.marchand@example.test", phone: "06 39 98 10 04" };
    const forward = findDuplicate(identity, CONTACTS);
    const backward = findDuplicate(identity, [...CONTACTS].reverse());
    // Two different contacts match on two different keys: the strongest key
    // (email) wins, whatever the order the rows came back in.
    expect(forward?.contactId).toBe(SOPHIE.id);
    expect(backward?.contactId).toBe(SOPHIE.id);
  });

  it("un doublon sur les deux clés l'emporte sur un doublon sur une seule", () => {
    const match = findDuplicate(
      { email: "s.marchand@example.test", phone: "06 39 98 10 04" },
      CONTACTS,
    );
    expect(match?.contactId).toBe(AUTRE_SOPHIE.id);
    expect(match?.matchedOn).toEqual(["email", "phone"]);
  });
});

describe("contactDisplayName", () => {
  it("compose le nom affiché, ou le dit clairement quand il n'y en a pas", () => {
    expect(contactDisplayName(SOPHIE)).toBe("Sophie Marchand");
    expect(contactDisplayName(SANS_COORDONNEES)).toBe("Jean");
    expect(
      contactDisplayName({ id: "x", first_name: null, last_name: null, email: null, phone: null }),
    ).toBe("contact sans nom");
  });
});
