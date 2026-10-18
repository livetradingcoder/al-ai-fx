import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { PRICING_LABEL_DEFAULTS } from "./labels";

const messagesDir = path.join(process.cwd(), "src/messages");
const locales = fs
  .readdirSync(messagesDir)
  .filter((file) => file.endsWith(".json"))
  .map((file) => ({
    locale: file.replace(".json", ""),
    landing: JSON.parse(fs.readFileSync(path.join(messagesDir, file), "utf8")).Landing as Record<string, string>,
  }));

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test("every language has every string the pricing section shows", () => {
  for (const { locale, landing } of locales) {
    for (const key of Object.keys(PRICING_LABEL_DEFAULTS)) {
      assert.equal(typeof landing[key], "string", `${locale} is missing Landing.${key}`);
    }
  }
});

test("the English dictionary and the in-code English defaults say the same thing", () => {
  const en = locales.find((l) => l.locale === "en")!.landing;
  for (const [key, text] of Object.entries(PRICING_LABEL_DEFAULTS)) {
    assert.equal(en[key], text, `Landing.${key}`);
  }
});

test("a translation keeps the same {placeholders} as the English, or the page prints a blank", () => {
  for (const { locale, landing } of locales) {
    for (const [key, english] of Object.entries(PRICING_LABEL_DEFAULTS)) {
      assert.deepEqual(placeholders(landing[key]), placeholders(english), `${locale} Landing.${key}`);
    }
  }
});
