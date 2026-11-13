import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./support/test";

// The expectations below describe the data in fixtures/flights.ts. They stick
// to what a user reads to identify a flight (number, airline, airport, status)
// and how many flights are listed; clock times and the "updated ... ago" line
// are left alone on purpose, because their format is not what is under test.

const JFK_DEPARTURES = ["AA100", "AA2345", "DL402", "DL88", "BA178", "UA15"];
const JFK_ARRIVALS = ["VS3", "AF22", "B6616"];

/** Opens the app and searches for an airport the way a visitor would. */
async function searchAirport(page: Page, code: string) {
  await page.goto("/");
  await page.getByLabel(/airport code/i).fill(code);
}

/** The results-table row for one flight. */
function flightRow(page: Page, flightNumber: string): Locator {
  return page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: flightNumber, exact: true }) });
}

/** Passes once the results list holds exactly these flights and the summary agrees. */
async function expectFlights(page: Page, flightNumbers: string[], noun = "flights?") {
  // The header row has column headers, not cells, so this counts flights only.
  const rows = page.getByRole("row").filter({ has: page.getByRole("cell") });
  await expect(rows).toHaveCount(flightNumbers.length);
  for (const flightNumber of flightNumbers) {
    await expect(flightRow(page, flightNumber)).toBeVisible();
  }
  await expect(
    page.getByText(new RegExp(`\\b${flightNumbers.length} ${noun}\\b`)),
  ).toBeVisible();
}

test("searching an airport lists its departures and arrivals", async ({ page }) => {
  await searchAirport(page, "JFK");

  await expectFlights(page, JFK_DEPARTURES);
  await expect(flightRow(page, "AA100")).toContainText("American Airlines");
  await expect(flightRow(page, "AA100")).toContainText("London Heathrow");
  await expect(flightRow(page, "AA2345")).toContainText(/delayed/i);
  await expect(flightRow(page, "BA178")).toContainText("British Airways");
  await expect(flightRow(page, "BA178")).toContainText(/cancelled/i);
  // The search lives in the URL so it can be shared or bookmarked.
  await expect(page).toHaveURL(/[?&]airport=JFK(&|$)/);

  await page.getByRole("button", { name: "Arrivals" }).click();

  await expectFlights(page, JFK_ARRIVALS);
  await expect(flightRow(page, "VS3")).toContainText("Virgin Atlantic");
  await expect(flightRow(page, "VS3")).toContainText("London Heathrow");
  await expect(flightRow(page, "AF22")).toContainText(/active/i);
  await expect(flightRow(page, "AA100")).toHaveCount(0);
});

test("airline, status and destination filters narrow the list", async ({ page }) => {
  await searchAirport(page, "JFK");
  await expectFlights(page, JFK_DEPARTURES);

  const airline = page.getByLabel("Airline", { exact: true });
  const status = page.getByLabel("Status", { exact: true });
  const destination = page.getByLabel("Destination", { exact: true });

  // The airline choices come from the flights that were loaded.
  await expect(airline.getByRole("option")).toHaveText([
    "All Airlines",
    "American Airlines",
    "British Airways",
    "Delta Air Lines",
    "United Airlines",
  ]);

  await airline.selectOption({ label: "Delta Air Lines" });
  await expectFlights(page, ["DL402", "DL88"]);

  await status.selectOption({ label: "Scheduled" });
  await expectFlights(page, ["DL88"]);

  await airline.selectOption({ label: "All Airlines" });
  await expectFlights(page, ["AA100", "DL88"]);

  await status.selectOption({ label: "Diverted" });
  await expect(page.getByText("No flights match the selected filters.")).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);

  await status.selectOption({ label: "All Statuses" });
  await expectFlights(page, JFK_DEPARTURES);

  await destination.fill("London");
  await expectFlights(page, ["AA100", "BA178"]);
});

test("a saved favorite appears on the Favorites page and reopens the search", async ({
  page,
}) => {
  await searchAirport(page, "JFK");
  await page.getByLabel("Airline", { exact: true }).selectOption({ label: "Delta Air Lines" });
  await expectFlights(page, ["DL402", "DL88"]);

  await page.getByRole("button", { name: "Save as favorite" }).click();
  await expect(page.getByRole("button", { name: "Remove from favorites" })).toBeVisible();

  await page.getByRole("link", { name: "Favorites" }).click();
  await expect(page.getByRole("heading", { name: "Favorites" })).toBeVisible();

  const favorites = page.getByRole("listitem");
  await expect(favorites).toHaveCount(1);
  await expect(favorites).toContainText("JFK");
  await expect(favorites).toContainText("Departures");
  await expect(favorites).toContainText("Delta Air Lines");

  // Favorites are kept in the browser, so they outlive a reload.
  await page.reload();
  await expect(favorites).toHaveCount(1);

  await favorites.getByRole("link").click();

  // The saved search comes back with its filter applied and marked as saved.
  await expectFlights(page, ["DL402", "DL88"]);
  await expect(page.getByLabel("Airline", { exact: true })).toHaveValue("Delta Air Lines");

  await page.getByRole("button", { name: "Remove from favorites" }).click();
  await expect(page.getByRole("button", { name: "Save as favorite" })).toBeVisible();

  await page.getByRole("link", { name: "Favorites" }).click();
  await expect(page.getByText(/no favorites yet/i)).toBeVisible();
  await expect(favorites).toHaveCount(0);
});

test("a rate-limited API shows the quota state, and a retry recovers", async ({
  page,
  api,
}) => {
  api.exhaustQuota();
  await searchAirport(page, "JFK");

  await expect(page.getByText(/quota reached/i)).toBeVisible();
  // Not the error shown for any other failure, and no stale or empty table.
  await expect(page.getByText("Couldn't load flights")).toHaveCount(0);
  await expect(page.getByRole("table")).toHaveCount(0);

  api.restoreQuota();
  await page.getByRole("button", { name: "Try again" }).click();

  await expectFlights(page, JFK_DEPARTURES);
  await expect(page.getByText(/quota reached/i)).toHaveCount(0);
});

test("looking up a flight number shows that flight", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "By Flight Number" }).click();
  await page.getByLabel(/flight number/i).fill("BA178");

  await expectFlights(page, ["BA178"], "results?");
  await expect(flightRow(page, "BA178")).toContainText("British Airways");
  await expect(flightRow(page, "BA178")).toContainText(/cancelled/i);
});
