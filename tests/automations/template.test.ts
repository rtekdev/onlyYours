import { describe, expect, it } from "vitest";

import { renderTemplate } from "@/lib/automations/template";

describe("automation templates", () => {
  const now = new Date("2026-07-03T14:30:00Z");

  it("substitutes the supported placeholders", () => {
    expect(renderTemplate("Journal {{date}}", now)).toBe("Journal 2026-07-03");
    expect(renderTemplate("At {{time}}", now)).toBe("At 14:30");
    expect(renderTemplate("{{datetime}}", now)).toBe("2026-07-03 14:30");
    expect(renderTemplate("{{ date }} spaced", now)).toBe("2026-07-03 spaced");
  });

  it("leaves unknown placeholders untouched (no template engine surface)", () => {
    expect(renderTemplate("Hi {{name}} on {{date}}", now)).toBe("Hi {{name}} on 2026-07-03");
  });

  it("passes plain text through unchanged", () => {
    expect(renderTemplate("no placeholders here", now)).toBe("no placeholders here");
  });
});
