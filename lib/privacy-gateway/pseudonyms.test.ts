import { describe, expect, it } from "vitest";

import { createPseudonymSession } from "./pseudonyms";

describe("pseudonymes éphémères", () => {
  it("donne le même jeton à la même valeur, et des jetons distincts à des valeurs distinctes", () => {
    const session = createPseudonymSession();
    const a = session.pseudonymize("EMAIL", "camille@example.test");
    const again = session.pseudonymize("EMAIL", "CAMILLE@example.test");
    const b = session.pseudonymize("EMAIL", "nicolas@example.test");
    expect(again).toBe(a);
    expect(b).not.toBe(a);
    expect(a).toMatch(/^\[EMAIL_1_[0-9a-f]{8}\]$/);
    expect(b).toMatch(/^\[EMAIL_2_[0-9a-f]{8}\]$/);
  });

  it("unifie les écritures d'un même numéro (+33, 0033, espaces)", () => {
    const session = createPseudonymSession();
    const a = session.pseudonymize("TEL", "06 39 98 10 01");
    expect(session.pseudonymize("TEL", "+33 6 39 98 10 01")).toBe(a);
    expect(session.pseudonymize("TEL", "0033639981001")).toBe(a);
  });

  it("change à chaque exécution : aucun jeton n'est réutilisable d'une exécution à l'autre", () => {
    const tags = new Set<string>();
    const tokens = new Set<string>();
    for (let index = 0; index < 200; index += 1) {
      const session = createPseudonymSession();
      tags.add(session.tag);
      tokens.add(session.pseudonymize("PERSONNE", "Camille Berthier"));
    }
    expect(tags.size).toBe(200);
    expect(tokens.size).toBe(200);
  });

  it("restitue les valeurs dans une structure, en profondeur", () => {
    const session = createPseudonymSession();
    const email = session.pseudonymize("EMAIL", "camille@example.test");
    const person = session.pseudonymize("PRENOM", "Camille", "Camille");
    const restored = session.restore({
      a: `Bonjour ${person}, écrivez à ${email}.`,
      nested: [{ b: `${person}` }, 12, null, true],
    });
    expect(restored.error).toBeNull();
    expect(restored.data).toEqual({
      a: "Bonjour Camille, écrivez à camille@example.test.",
      nested: [{ b: "Camille" }, 12, null, true],
    });
  });

  it("refuse un jeton inventé, modifié ou venant d'une autre exécution", () => {
    const first = createPseudonymSession();
    const stale = first.pseudonymize("EMAIL", "camille@example.test");
    const session = createPseudonymSession();
    session.pseudonymize("EMAIL", "nicolas@example.test");

    for (const forged of [stale, `[EMAIL_9_${session.tag}]`, "[EMAIL_1_deadbeef]", "[TEL_1_xxxx]"]) {
      const result = session.restore({ text: `contact ${forged}` });
      expect(result.data, forged).toBeNull();
      expect(result.error?.code, forged).toBe("pseudonym_unknown");
    }
  });

  it("neutralise un faux jeton écrit par un prospect", () => {
    const session = createPseudonymSession();
    expect(session.neutralise("mon email est [EMAIL_1_deadbeef] ok")).toBe("mon email est […] ok");
    expect(session.neutralise("aucun jeton ici [note]")).toBe("aucun jeton ici [note]");
  });

  it("détruit la table : plus de restitution après destroy", () => {
    const session = createPseudonymSession();
    const token = session.pseudonymize("EMAIL", "camille@example.test");
    session.destroy();
    expect(session.isDestroyed()).toBe(true);
    expect(session.restore(token).error?.code).toBe("pseudonym_session_destroyed");
    expect(() => session.pseudonymize("EMAIL", "x@example.test")).toThrow();
    expect(session.counts()).toEqual({});
  });

  it("compte les remplacements par type, jamais les valeurs", () => {
    const session = createPseudonymSession();
    session.pseudonymize("EMAIL", "camille@example.test");
    session.pseudonymize("EMAIL", "camille@example.test");
    session.pseudonymize("TEL", "0639981001");
    expect(session.counts()).toEqual({ EMAIL: 2, TEL: 1 });
    expect(JSON.stringify(session.counts())).not.toContain("example.test");
  });
});
