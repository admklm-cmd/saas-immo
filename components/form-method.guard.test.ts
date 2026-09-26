import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Guard: every `<form>` in the app declares its submission explicitly.
 *
 * A form without `method` or `action` falls back to a native GET on the current
 * URL. Client forms handle `onSubmit` + `preventDefault()`, but a user who
 * submits before React hydrates bypasses that handler: every named field then
 * lands in the query string — and so in the browser history, the Referer
 * header and every access log on the way (this happened with the sign-in
 * password). `method="post"` keeps any such pre-hydration submission in the
 * request body; a server-action `action={...}` is POST by construction.
 *
 * A deliberate GET (e.g. search filters with no personal data) stays possible,
 * but must be written `method="get"` so the choice is visible in review.
 */

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SCANNED_DIRS = ["app", "features", "components"];

function listTsxSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listTsxSources(full));
    } else if (entry.endsWith(".tsx") && !entry.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Returns the opening tag of every JSX `<form ...>` in `source`, following
 * `{...}` expressions and string literals so a `>` inside an arrow function
 * or a class string does not end the tag early.
 */
function extractFormOpeningTags(source: string): string[] {
  const tags: string[] = [];
  const opener = /<form(?=[\s>/])/g;
  let match: RegExpExecArray | null;
  while ((match = opener.exec(source)) !== null) {
    const start = match.index;
    let end = -1;
    scanTag(source, start + match[0].length, (ch, i, depth) => {
      if (ch === ">" && depth === 0) {
        end = i;
        return true;
      }
      return false;
    });
    if (end === -1) break;
    tags.push(source.slice(start, end + 1));
  }
  return tags;
}

/**
 * Walks `text` from `from`, skipping string literals and `//` / `/* *\/`
 * comments, and calls `visit` for every other character with the current
 * `{}` depth. Stops when `visit` returns true.
 */
function scanTag(text: string, from: number, visit: (ch: string, index: number, depth: number) => boolean) {
  let depth = 0;
  let quote: string | null = null;
  for (let i = from; i < text.length; i++) {
    const ch = text[i] ?? "";
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "/" && text[i + 1] === "/") {
      const newline = text.indexOf("\n", i);
      i = newline === -1 ? text.length : newline;
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      const close = text.indexOf("*/", i + 2);
      i = close === -1 ? text.length : close + 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    if (visit(ch, i, depth)) return;
  }
}

/** Attribute names at brace depth 0 only (ignores handlers, strings, comments). */
function topLevelAttributeNames(tag: string): Set<string> {
  let flat = "";
  scanTag(tag, 0, (ch, _i, depth) => {
    if (depth === 0 && ch !== "}") flat += ch;
    return false;
  });
  return new Set(Array.from(flat.matchAll(/([A-Za-z-]+)\s*=/g), (m) => m[1] ?? ""));
}

function hasExplicitSubmission(tag: string): boolean {
  const attributes = topLevelAttributeNames(tag);
  return attributes.has("method") || attributes.has("action");
}

function firstTag(source: string): string {
  const [tag] = extractFormOpeningTags(source);
  if (tag === undefined) throw new Error("no <form> tag found");
  return tag;
}

describe("form submission guard (scanner)", () => {
  it("flags a client form with onSubmit and no method/action", () => {
    const tag = firstTag(
      `<form noValidate onSubmit={(e) => { e.preventDefault(); if (a > b) go(); }} className="x">`,
    );
    expect(tag).toMatch(/className="x">$/);
    expect(hasExplicitSubmission(tag)).toBe(false);
  });

  it("does not accept 'method' appearing only inside a handler or a comment", () => {
    const tag = firstTag(
      `<form\n  // don't -> method="post" is missing on purpose\n  /* action={x} */\n  onSubmit={() => send({ method: "post", note: "}" })}\n>`,
    );
    expect(hasExplicitSubmission(tag)).toBe(false);
  });

  it("accepts method=post, method=get and a server action", () => {
    for (const source of [
      `<form method="post" onSubmit={h}>`,
      `<form method="get" action="/agents-ia">`,
      `<form action={signOut}>`,
    ]) {
      const tag = firstTag(source);
      expect(hasExplicitSubmission(tag)).toBe(true);
    }
  });

  it("ignores components whose name starts with 'form'", () => {
    expect(extractFormOpeningTags(`<formatted-value /> <FormField />`)).toEqual([]);
  });
});

describe("form submission guard (codebase)", () => {
  const files = SCANNED_DIRS.flatMap((dir) => listTsxSources(join(ROOT, dir)));

  it("scans a non-empty set of sources containing forms", () => {
    const withForms = files.filter((file) => extractFormOpeningTags(readFileSync(file, "utf8")).length > 0);
    expect(withForms.length).toBeGreaterThan(0);
  });

  it("every <form> declares method= or a server action=", () => {
    const offenders = files.flatMap((file) =>
      extractFormOpeningTags(readFileSync(file, "utf8"))
        .filter((tag) => !hasExplicitSubmission(tag))
        .map((tag) => `${relative(ROOT, file)}: ${tag.split("\n")[0]}`),
    );
    expect(offenders).toEqual([]);
  });
});
