import { describe, expect, it } from "vitest";

import { airlineCode, airlineLogoUrl } from "@/lib/airlines";

describe("airlineCode", () => {
  it.each([
    ["AA100", "AA"],
    ["DL88", "DL"],
    ["B6616", "B6"],
    ["U21234", "U2"],
    ["9W12", "9W"],
    ["ba178", "BA"],
    ["LH400A", "LH"],
  ])("reads %s as %s", (flightNumber, code) => {
    expect(airlineCode(flightNumber)).toBe(code);
  });

  it.each(["BAW178", "12345", "A", "", "AA"])("has no code for %j", (flightNumber) => {
    expect(airlineCode(flightNumber)).toBeNull();
  });
});

describe("airlineLogoUrl", () => {
  it("asks the logo service for a wide wordmark", () => {
    expect(airlineLogoUrl("B6")).toBe("https://pics.avs.io/120/40/B6.png");
  });
});
