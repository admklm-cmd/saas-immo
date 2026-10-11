import { describe, expect, it } from "vitest";

import { NO_KNOWN_ENTITIES, type KnownEntities } from "./detectors";
import { createPseudonymSession } from "./pseudonyms";
import { normaliseForDetection, pseudonymiseText, sanitizeAiRequest } from "./sanitize";

/**
 * Security review of 2026-10-11: obfuscations found by attacking the detector.
 * Every case below leaked (or leaked partially) before the fix.
 */

const KNOWN: KnownEntities = {
  persons: [
    { firstName: "Camille", lastName: "Berthier" },
    { firstName: "Jean-Pierre", lastName: "de la Fontaine" },
  ],
  agencyName: "Calanques Immobilier",
  emails: ["camille.berthier@example.test"],
  phones: ["06 39 98 10 01"],
};

function run(text: string, known: KnownEntities = KNOWN): string {
  return pseudonymiseText(text, known, createPseudonymSession(() => "9f3a07c2"));
}

describe("emails obfusqués", () => {
  it.each([
    ["accolades", "écrivez à paul.durand{at}gmail.com merci", "paul.durand"],
    ["crochets autour de l'arobase", "paul.durand [@] gmail.com", "paul.durand"],
    ["espaces autour des points", "paul . durand @ gmail . com", "durand"],
    ["at / dot en toutes lettres", "mon mail : paul.durand at gmail dot com", "paul.durand"],
    ["arobase en clair", "paul.durand arobase gmail.com", "paul.durand"],
    ["majuscules", "PAUL.DURAND@GMAIL.COM", "PAUL"],
    ["arobase pleine largeur", "paul.durand＠gmail.com", "paul.durand"],
    ["point idéographique", "paul.durand@gmail。com", "gmail"],
  ])("%s", (_label, text, secret) => {
    expect(run(text, NO_KNOWN_ENTITIES)).not.toContain(secret);
  });

  it("ne prend pas une phrase ordinaire pour un email", () => {
    expect(run("Rendez-vous at 10h puis visite.", NO_KNOWN_ENTITIES)).toBe("Rendez-vous at 10h puis visite.");
  });
});

describe("téléphones aux séparateurs variés", () => {
  it.each([
    ["+33 entre parenthèses", "(+33)6 39 98 10 01"],
    ["séparateurs mélangés", "06 39.98-10 01"],
    ["premier chiffre isolé", "0 6 39 98 10 01"],
    ["groupes de quatre", "06 3998 1001"],
    ["sans le plus", "33639981001"],
    ["pleine largeur", "０６ ３９ ９８ １０ ０１"],
    ["espace insécable fine", "06 39 98 10 01"],
    ["caractère invisible", "06 39​98 10 01"],
  ])("%s", (_label, phone) => {
    expect(run(`rappelez-moi au ${phone} svp`, NO_KNOWN_ENTITIES)).not.toMatch(/39\D{0,3}98|3998|639981001/);
  });

  it("ne prend pas une date suivie d'une heure pour un numéro", () => {
    expect(run("rdv le 01.02.2026 10h", NO_KNOWN_ENTITIES)).toBe("rdv le 01.02.2026 10h");
    expect(run("rdv le 05/11/2026 à 14 h", NO_KNOWN_ENTITIES)).toBe("rdv le 05/11/2026 à 14 h");
  });
});

describe("noms du dossier abrégés ou composés", () => {
  it.each([
    ["nom sans la particule", "le dossier Fontaine est prêt", "Fontaine"],
    ["partie d'un prénom composé", "Jean a appelé hier", "Jean"],
    ["nom en majuscules accentuées", "BÉRTHIER vous écrit", "BÉRTHIER"],
    ["caractère invisible dans le nom", "Berth​ier vous écrit", "Berth"],
  ])("%s", (_label, text, secret) => {
    expect(run(text)).not.toContain(secret);
  });
});

describe("autres identifiants", () => {
  it("IBAN avec tirets : rien ne reste", () => {
    expect(run("FR76-3000-6000-0112-3456-7890-189", NO_KNOWN_ENTITIES)).not.toMatch(/7890|189/);
  });
  it("identifiant technique sans tirets", () => {
    expect(run("id 6f1c2d3e4a5b4c6d8e7f0123456789ab", NO_KNOWN_ENTITIES)).not.toMatch(/6f1c|89ab/);
  });
  it("identifiant de réseau social", () => {
    expect(run("mon insta : @camille_b13", NO_KNOWN_ENTITIES)).not.toContain("camille_b13");
  });
  it("adresse abrégée", () => {
    expect(run("j'habite 3 all. des Pins", NO_KNOWN_ENTITIES)).not.toContain("Pins");
  });
});

describe("normalisation", () => {
  it("un faux jeton écrit en pleine largeur ne devient pas un vrai jeton", () => {
    const out = run("［EMAIL_1_9f3a07c2］", NO_KNOWN_ENTITIES);
    expect(out).not.toContain("EMAIL_1_9f3a07c2]");
  });
  it("retire les caractères invisibles et ramène les pleines largeurs", () => {
    expect(normaliseForDetection("a​b０")).toBe("ab0");
  });
});

describe("Léa : un nom écrit en texte libre sans indice ne part pas", () => {
  const base = {
    task: "lea_acquisition" as const,
    systemPrompt: "Tu es Léa.",
    promptVersion: "test",
    facts: {
      lead_source: "estimation_form",
      lead_raw_text_chars: 40,
      payload_has_first_name: false,
      payload_has_last_name: false,
      payload_has_email: false,
      payload_has_phone: false,
    },
    untrusted: [{ label: "lead_texte_brut", content: "Ma voisine Jeannette Marchand vend aussi." }],
  };

  it("refuse tant que le dossier ne donne pas un prénom ET un nom", () => {
    const session = createPseudonymSession(() => "9f3a07c2");
    for (const persons of [[], [{ firstName: "Camille", lastName: null }], [{ firstName: null, lastName: "Berthier" }]]) {
      const out = sanitizeAiRequest({ ...base, privacy: { persons } }, session);
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.reason).toBe("identity_unknown_for_free_text");
    }
  });

  it("accepte quand le prénom et le nom sont connus", () => {
    const session = createPseudonymSession(() => "9f3a07c2");
    const out = sanitizeAiRequest(
      { ...base, privacy: { persons: [{ firstName: "Camille", lastName: "Berthier" }] } },
      session,
    );
    expect(out.ok).toBe(true);
  });
});
