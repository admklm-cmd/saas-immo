import { describe, expect, it } from "vitest";

import { detectIdentifiers, foldForMatching, phoneDigits, type KnownEntities } from "./detectors";

/**
 * Isolated tests of the identifier detectors. Every phone number below belongs
 * to the Arcep fiction blocks (06 39 98 / 04 65 71) used by the fixtures.
 */

function typesIn(text: string, known?: KnownEntities) {
  return detectIdentifiers(text, known).map((span) => ({ type: span.type, value: span.value }));
}

describe("emails", () => {
  it.each([
    "camille.berthier@example.test",
    "Camille.Berthier+agence@Example.test",
    "c_b-75@sub.domaine-exemple.fr",
  ])("détecte %s", (email) => {
    expect(typesIn(`Écrivez-moi à ${email}.`)).toEqual([{ type: "EMAIL", value: email }]);
  });

  it("détecte les formes masquées (at, arobase)", () => {
    expect(typesIn("camille [at] example.test")[0]?.type).toBe("EMAIL");
    expect(typesIn("camille (arobase) example.test")[0]?.type).toBe("EMAIL");
    expect(typesIn("camille arobase example.test")[0]?.type).toBe("EMAIL");
  });

  it("ne confond pas un email avec un lien", () => {
    const spans = typesIn("camille@example.test");
    expect(spans).toHaveLength(1);
    expect(spans[0]?.type).toBe("EMAIL");
  });
});

describe("téléphones français", () => {
  it.each([
    "06 39 98 10 01",
    "06.39.98.10.01",
    "06-39-98-10-01",
    "0639981001",
    "+33 6 39 98 10 01",
    "+33639981001",
    "0033 6 39 98 10 01",
    "+33 (0)6 39 98 10 01",
    "04 65 71 12 34",
    "06 39 98 10 01",
    "04 65 711 234",
  ])("détecte %j", (phone) => {
    const spans = typesIn(`Rappelez-moi au ${phone} après 18h.`);
    expect(spans.map((span) => span.type)).toEqual(["TEL"]);
    expect(phoneDigits(spans[0]?.value ?? "")).toBe(phoneDigits(phone));
  });

  it("détecte un numéro international", () => {
    expect(typesIn("Mon numéro belge : +32 475 12 34 56")[0]?.type).toBe("TEL");
  });

  it("ne prend pas une date ni un code postal pour un numéro", () => {
    expect(typesIn("Rendez-vous le 05 11 2026 à 10 00 pour le 13600 La Ciotat, 120 m2.")).toEqual([]);
  });

  it("normalise +33 et 0 vers les mêmes chiffres", () => {
    expect(phoneDigits("+33 6 39 98 10 01")).toBe("0639981001");
    expect(phoneDigits("0033 6 39 98 10 01")).toBe("0639981001");
    expect(phoneDigits("+33 (0)6 39 98 10 01")).toBe("0639981001");
    expect(phoneDigits("06 39 98 10 01")).toBe("0639981001");
  });
});

describe("liens", () => {
  it.each([
    "https://www.example.test/annonce?id=12",
    "http://example.test",
    "www.example.test",
    "agence-exemple.fr/estimation",
  ])("détecte %s", (url) => {
    const spans = typesIn(`Voir ${url} svp`);
    expect(spans.map((span) => span.type)).toEqual(["URL"]);
  });

  it("ne traite pas une fin de phrase collée comme un lien", () => {
    expect(typesIn("C'est urgent.Merci de répondre.")).toEqual([]);
  });
});

describe("adresses postales", () => {
  it.each([
    "12 rue de la République",
    "3bis avenue du Prado",
    "45, boulevard Michelet",
    "8 impasse des Oliviers",
    "27 chemin de la Gardiole",
    "1 place Jean Jaurès",
    "avenue du 8 Mai 1945",
    "Rue Paradis",
    "12 rue du port",
  ])("détecte %j", (address) => {
    const spans = typesIn(`Le bien est situé ${address}, à côté de la mairie.`);
    expect(spans.some((span) => span.type === "ADRESSE")).toBe(true);
  });

  it("ne confond pas les noms communs avec une adresse", () => {
    expect(typesIn("Il y a une place de parking et la route était bloquée sur place.")).toEqual([]);
  });

  it("n'avale pas la ville qui suit", () => {
    const span = detectIdentifiers("12 rue Paradis, 13600 La Ciotat")[0];
    expect(span?.type).toBe("ADRESSE");
    expect(span?.value).toBe("12 rue Paradis");
  });
});

describe("autres identifiants", () => {
  it("détecte un IBAN, avec ou sans espaces", () => {
    expect(typesIn("IBAN FR76 3000 6000 0112 3456 7890 189 merci")[0]?.type).toBe("IBAN");
    expect(typesIn("FR7630006000011234567890189")[0]?.type).toBe("IBAN");
  });

  it("détecte un identifiant technique (uuid)", () => {
    expect(typesIn("contact 6f1c2d3e-4a5b-4c6d-8e7f-0123456789ab ouvert")[0]?.type).toBe("ID");
  });

  it("détecte un numéro de sécurité sociale et une carte bancaire", () => {
    expect(typesIn("NIR 1 85 05 78 006 084 36")[0]?.type).toBe("SECU");
    expect(typesIn("carte 4970 1012 3456 7890")[0]?.type).toBe("CARTE");
  });
});

describe("noms", () => {
  const known: KnownEntities = {
    persons: [{ firstName: "Camille", lastName: "Berthier" }],
    agencyName: "Calanques Immobilier",
    emails: [],
    phones: [],
  };

  it("reconnaît le nom complet du dossier dans les deux ordres, avec ou sans accent ni majuscule", () => {
    const spans = detectIdentifiers("camille berthier / BERTHIER Camille / Cámille  Berthier", known);
    expect(spans.map((span) => span.type)).toEqual(["PERSONNE", "PERSONNE", "PERSONNE"]);
    expect(new Set(spans.map((span) => span.canonical))).toEqual(new Set(["Camille Berthier"]));
  });

  it("reconnaît le prénom seul et le nom seul", () => {
    const spans = detectIdentifiers("Camille est partie, la famille Berthier hésite.", known);
    expect(spans.map((span) => span.type)).toEqual(["PRENOM", "NOM"]);
  });

  it("ne coupe pas un mot qui contient le prénom", () => {
    expect(detectIdentifiers("Un camillien ou la Camillerie", known)).toEqual([]);
  });

  it("reconnaît le nom de l'agence", () => {
    const spans = detectIdentifiers("Cordialement, l'équipe de Calanques  Immobilier", known);
    expect(spans.some((span) => span.type === "AGENCE")).toBe(true);
  });

  it("reconnaît un tiers introduit par une civilité", () => {
    const spans = detectIdentifiers("Le dossier est suivi par Mme Dupont-Lefèvre et M. Jean Martin.");
    expect(spans.map((span) => span.value)).toEqual(["Dupont-Lefèvre", "Jean Martin"]);
  });

  it("reconnaît une personne qui se présente ou qui signe", () => {
    expect(typesIn("Bonjour, je m'appelle Paul Verdier et je vends.")[0]?.value).toBe("Paul Verdier");
    expect(typesIn("Merci pour votre retour.\nCordialement,\nLucie Garnier\nLa Ciotat")[0]?.value).toBe("Lucie Garnier");
    expect(typesIn("Bonjour Pierre, voici le point.")[0]?.value).toBe("Pierre");
  });

  it("ne prend pas une phrase ordinaire pour un nom", () => {
    expect(typesIn("Bonjour, je souhaite une estimation. Cordialement")).toEqual([]);
    expect(typesIn("Bonjour\nTout va bien pour la vente.")).toEqual([]);
  });
});

describe("robustesse", () => {
  it("conserve les index sur le texte d'origine (pliage sans changement de longueur)", () => {
    const text = "ÉLÉONORE à Çà et Là ŒUVRE İstanbul";
    expect(foldForMatching(text)).toHaveLength(text.length);
  });

  it("reste linéaire sur une entrée hostile", () => {
    const hostile = [
      `${"a".repeat(18_000)}@${"b.".repeat(1_000)}`,
      "0 ".repeat(9_000),
      "rue ".repeat(4_000),
      "Rue Abc ".repeat(2_500),
      "1".repeat(20_000),
      "a.".repeat(10_000),
      "www.".repeat(5_000),
      "12 rue de la ".repeat(1_500),
      "Bonjour Marie ".repeat(1_400),
    ];
    const started = Date.now();
    for (const text of hostile) detectIdentifiers(text);
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});
