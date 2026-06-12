import { expect, test } from "@playwright/test";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

test("organizer publishes a complete trip and a traveler uses the shared view", async ({ browser, page }) => {
  const email = `e2e-${Date.now()}@example.com`;
  const password = "TestPassword123!";

  await page.goto("/register");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm Password").fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(/\/login\?notice=account-created/);
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole("link", { name: "Create New Trip" }).click();
  await page.getByLabel("Trip Name").fill("Alaska E2E");
  await page.getByLabel("Trip Type").selectOption("Cruise");
  await page.getByLabel("Start Date").fill("2026-06-26");
  await page.getByLabel("End Date").fill("2026-07-06");
  await page.getByLabel("Traveler Count").fill("2");
  await page.getByRole("button", { name: "Save Draft" }).click();
  await page.getByRole("link", { name: "Alaska E2E" }).click();

  const travelForm = page.locator("#travel form").nth(1);
  await travelForm.locator('[name="type"]').selectOption("Flight");
  await travelForm.locator('[name="title"]').fill("Flight to Seattle");
  await travelForm.locator('[name="date"]').fill("2026-06-26");
  await travelForm.locator('[name="time"]').fill("09:00");
  await travelForm.locator('[name="startLocation"]').fill("SRQ");
  await travelForm.locator('[name="destination"]').fill("Seattle");
  await travelForm.locator('[name="direction"]').selectOption("ROUND_TRIP");
  await travelForm.getByRole("button", { name: "Add Segment" }).click();
  await expect(page.locator("#travel")).toContainText("Travel saved.");

  const itineraryForm = page.locator("#itinerary form").first();
  await itineraryForm.locator('[name="date"]').fill("2026-06-27");
  await itineraryForm.locator('[name="time"]').fill("12:00");
  await itineraryForm.locator('[name="title"]').fill("Space Needle");
  await itineraryForm.locator('[name="description"]').fill("Seattle landmark");
  await itineraryForm.getByRole("button", { name: "Add Item" }).click();
  await expect(page.locator("#itinerary")).toContainText("Itinerary item saved.");

  const updateForm = page.locator("#updates form").first();
  await updateForm.locator('[name="updateType"]').selectOption("TRAVEL");
  await updateForm.locator('[name="travelSegmentId"]').selectOption({ index: 1 });
  await updateForm.locator('[name="updateKind"]').selectOption("SCHEDULE_CHANGE");
  await updateForm.locator('[name="newTime"]').fill("10:15");
  await updateForm.locator('[name="title"]').fill("Flight time changed");
  await updateForm.locator('[name="content"]').fill("Departure is now 10:15 AM");
  await updateForm.getByRole("button", { name: "Add Update" }).click();
  await expect(page.locator("#updates")).toContainText("Update saved.");

  await page.locator("#documents input[type=file]").setInputFiles({ name: "guide.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") });
  await page.locator("#documents").getByRole("button", { name: "Upload" }).click();
  await expect(page.locator("#documents")).toContainText("Document uploaded successfully");
  await page.locator("#photos input[type=file]").setInputFiles({ name: "view.png", mimeType: "image/png", buffer: png });
  await page.locator("#photos").getByRole("button", { name: "Upload" }).click();
  await expect(page.locator("#photos")).toContainText("Photo uploaded successfully");

  await page.getByPlaceholder("Poll question").fill("Visit the museum?");
  await page.getByPlaceholder("One choice per line").fill("Yes\nNo");
  await page.getByRole("button", { name: "Create Poll" }).click();
  await expect(page.getByText("Poll saved.")).toBeVisible();
  await page.getByRole("button", { name: "Generate Public Link" }).click();
  await expect(page.getByText("Public share link saved.")).toBeVisible();
  const sharePath = await page.locator('a[href^="/share/"]').first().getAttribute("href");
  expect(sharePath).toBeTruthy();

  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Trip published.")).toBeVisible();

  const travelerContext = await browser.newContext({ baseURL: "http://127.0.0.1:3100" });
  const traveler = await travelerContext.newPage();
  await traveler.goto(sharePath!);
  await expect(traveler.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(traveler.getByRole("heading", { name: "Travel", exact: true })).toBeVisible();
  await expect(traveler.getByRole("heading", { name: "Itinerary", exact: true })).toBeVisible();
  await expect(traveler.getByText("UPDATE", { exact: true }).first()).toBeVisible();
  const documentLink = traveler.getByRole("link", { name: "guide.pdf" });
  await expect(documentLink).toBeVisible();
  expect((await traveler.request.get((await documentLink.getAttribute("href"))!)).status()).toBe(200);
  const photoImage = traveler.getByAltText("view.png");
  await expect(photoImage).toBeVisible();
  expect((await traveler.request.get((await photoImage.getAttribute("src"))!)).status()).toBe(200);
  await traveler.getByRole("button", { name: /Yes/ }).click();
  await expect(traveler.getByText("Vote recorded")).toBeVisible();

  await page.getByRole("button", { name: "Unpublish" }).click();
  await expect(page.getByText("Trip unpublished.")).toBeVisible();
  await traveler.reload();
  await expect(traveler.getByRole("heading", { name: "404" })).toBeVisible();
  await travelerContext.close();
});
