import { describe, expect, it } from "vitest";

import {
  describeClouds,
  describeVisibility,
  describeWind,
  heading,
  toFahrenheit,
} from "@/lib/weather";

const calm = { wind_direction_deg: null, wind_variable: false, wind_gust_kt: null };

describe("describeWind", () => {
  it("gives direction and speed", () => {
    expect(describeWind({ ...calm, wind_direction_deg: 10, wind_speed_kt: 10 })).toBe(
      "From 010° at 10 kt",
    );
  });

  it("adds gusts above the steady speed", () => {
    expect(
      describeWind({ ...calm, wind_direction_deg: 270, wind_speed_kt: 12, wind_gust_kt: 22 }),
    ).toBe("From 270° at 12 kt, gusting 22");
  });

  it("says variable wind and calm in words", () => {
    expect(describeWind({ ...calm, wind_variable: true, wind_speed_kt: 4 })).toBe("Variable at 4 kt");
    expect(describeWind({ ...calm, wind_direction_deg: 0, wind_speed_kt: 0 })).toBe("Calm");
  });

  it("is null without wind data", () => {
    expect(describeWind({ ...calm, wind_speed_kt: null })).toBeNull();
  });
});

describe("describeClouds", () => {
  it("names the lowest layer with its height", () => {
    expect(describeClouds([{ cover: "FEW", base_ft: 25000 }])).toBe("Few clouds at 25,000 ft");
  });

  it("reports the ceiling over thinner layers below it", () => {
    expect(
      describeClouds([
        { cover: "FEW", base_ft: 1200 },
        { cover: "BKN", base_ft: 1500 },
        { cover: "OVC", base_ft: 2000 },
      ]),
    ).toBe("Broken clouds at 1,500 ft");
  });

  it("calls a clear sky clear", () => {
    expect(describeClouds([{ cover: "CLR", base_ft: null }])).toBe("Clear");
    expect(describeClouds([{ cover: "CAVOK", base_ft: null }])).toBe("Clear");
  });

  it("is null without cloud data", () => {
    expect(describeClouds([])).toBeNull();
  });
});

describe("small formatters", () => {
  it("formats headings, temperatures and visibility", () => {
    expect(heading(10)).toBe("010°");
    expect(heading(360)).toBe("000°");
    expect(toFahrenheit(3.3)).toBe(38);
    expect(toFahrenheit(-40)).toBe(-40);
    expect(describeVisibility("10+")).toBe("10+ mi");
    expect(describeVisibility(null)).toBeNull();
  });
});
