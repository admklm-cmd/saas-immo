import { describe, expect, it } from "vitest";

import { buildFixtures, NOTABLE_CONTACTS } from "./dataset";
import {
  FIXTURE_AGENCY_IDS,
  FIXTURE_ACCOUNT_EMAIL_DOMAINS,
  FIXTURE_PHONE_PATTERN,
  FIXTURE_USER_IDS,
  FIXTURE_USERS,
  fictionLandline,
  fictionMobile,
  fixtureUuid,
  isFixtureAccountEmail,
} from "./fixture-ids";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("fixtures : identifiants", () => {
  it("produit des UUID valides et stables", () => {
    expect(fixtureUuid("contact:camille-berthier")).toMatch(UUID);
    expect(fixtureUuid("contact:camille-berthier")).toBe(fixtureUuid("contact:camille-berthier"));
    expect(fixtureUuid("contact:camille-berthier")).not.toBe(fixtureUuid("contact:nicolas-fabre"));
    expect(FIXTURE_AGENCY_IDS.a).not.toBe(FIXTURE_AGENCY_IDS.b);
  });

  it("n'utilise que des numéros des tranches de fiction de l'Arcep", () => {
    expect(fictionMobile("1234")).toBe("06 39 98 12 34");
    expect(fictionLandline("5678")).toBe("04 65 71 56 78");
    expect(FIXTURE_PHONE_PATTERN.test(fictionMobile("1234"))).toBe(true);
    expect(FIXTURE_PHONE_PATTERN.test(fictionLandline("5678"))).toBe(true);
    // A real-looking French mobile number must never pass.
    expect(FIXTURE_PHONE_PATTERN.test("06 12 34 56 78")).toBe(false);
  });

  it("n'utilise que des domaines réservés (.test) pour les comptes de test", () => {
    for (const domain of FIXTURE_ACCOUNT_EMAIL_DOMAINS) {
      expect(domain.endsWith(".test")).toBe(true);
    }
    for (const user of FIXTURE_USERS) {
      expect(isFixtureAccountEmail(user.email), user.email).toBe(true);
    }
    expect(isFixtureAccountEmail("quelquun@gmail.com")).toBe(false);
    expect(isFixtureAccountEmail("piege@ascend.test.evil.com")).toBe(false);
    expect(isFixtureAccountEmail(null)).toBe(false);
  });

  it("déclare le compte propriétaire en direction de l'agence A, mot de passe lu dans l'environnement", () => {
    const owner = FIXTURE_USERS.find((user) => user.key === "ownerA");
    expect(owner).toMatchObject({
      email: "adm.hatira@ascend.test",
      agency: "a",
      role: "director",
      passwordEnvVar: "FIXTURES_PASSWORD_OWNER",
      displayName: "Adm Hatira",
    });
    expect(FIXTURE_USER_IDS.ownerA).toBe(owner?.id);
  });

  it("garde des clés, identifiants, e-mails et variables de mot de passe uniques", () => {
    for (const field of ["key", "id", "email", "passwordEnvVar"] as const) {
      const values = FIXTURE_USERS.map((user) => user[field]);
      expect(new Set(values).size, field).toBe(values.length);
    }
    expect(Object.values(FIXTURE_USER_IDS).sort()).toEqual(FIXTURE_USERS.map((user) => user.id).sort());
  });
});

describe("fixtures : jeu de données", () => {
  const now = new Date("2026-09-16T12:00:00Z");
  const { a, b } = buildFixtures(now);

  it("porte la mention « (fictive) » dans les deux noms d'agence", () => {
    expect(a.agency.name).toContain("(fictive)");
    expect(b.agency.name).toContain("(fictive)");
  });

  it("ne marque jamais une ligne comme réelle", () => {
    const flagged = [...a.appointments, ...a.outboundMessages, ...a.activities, ...b.appointments, ...b.activities];
    expect(flagged.length).toBeGreaterThan(0);
    expect(flagged.every((row) => row.is_simulation !== false)).toBe(true);
    expect(a.aiAgentRuns.every((run) => run.insert.is_simulation === true)).toBe(true);
  });

  it("place les rendez-vous à venir dans le futur et en semaine", () => {
    const upcoming = a.appointments.filter((appointment) => appointment.status !== "done" && appointment.status !== "cancelled");
    expect(upcoming.length).toBeGreaterThanOrEqual(3);
    for (const appointment of upcoming) {
      const start = new Date(appointment.starts_at);
      expect(start.getTime()).toBeGreaterThan(now.getTime());
      expect([1, 2, 3, 4, 5]).toContain(start.getUTCDay());
    }
  });

  it("ne planifie jamais deux rendez-vous actifs qui se chevauchent pour un même conseiller", () => {
    const active = a.appointments.filter((appointment) => appointment.status === "proposed" || appointment.status === "confirmed");
    for (const [index, first] of active.entries()) {
      for (const second of active.slice(index + 1)) {
        if (first.assigned_user_id !== second.assigned_user_id) continue;
        const overlap =
          new Date(first.starts_at) < new Date(second.ends_at) && new Date(second.starts_at) < new Date(first.ends_at);
        expect(overlap, `${first.starts_at} / ${second.starts_at}`).toBe(false);
      }
    }
  });

  it("n'invente aucune information pour le contact incomplet", () => {
    const contact = a.contacts.find((candidate) => candidate.id === NOTABLE_CONTACTS.missingInformation);
    expect(contact).toBeDefined();
    expect(contact?.sale_motivation).toBeNull();
    expect(contact?.sale_timeline).toBeNull();
  });

  it("n'attache aucun consentement au contact « sans consentement »", () => {
    expect(a.consents.some((consent) => consent.contact_id === NOTABLE_CONTACTS.noConsent)).toBe(false);
  });

  it("documente le texte, la version et la preuve de chaque consentement accordé", () => {
    const granted = [...a.consents, ...b.consents].filter((consent) => consent.status === "granted");
    expect(granted.length).toBeGreaterThan(0);
    for (const consent of granted) {
      expect(consent.presented_text).toBeTruthy();
      expect(consent.text_version).toBeTruthy();
      expect(Object.keys(consent.proof as Record<string, unknown>).length).toBeGreaterThan(0);
    }
  });
});
