import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LinkedUpdateBadge, TravelerUpdateProvider } from "@/app/trips/[id]/preview/traveler-update-awareness";

const update = {
  id: 1, title: "Changed", content: "New time", createdAt: new Date(), updatedAt: new Date(),
  updateType: "TRAVEL", updateKind: "SCHEDULE_CHANGE", travelSegmentId: 1, itineraryItemId: null,
  originalDate: new Date(), originalTime: "09:00", newDate: new Date(), newTime: "10:00",
};

describe("UPDATE indicators", () => {
  it("renders for an active linked update", () => {
    const html = renderToStaticMarkup(
      <TravelerUpdateProvider initialNow={Date.now()}>
        <LinkedUpdateBadge updates={[{ ...update, expiresAt: new Date(Date.now() + 60_000) }]} />
      </TravelerUpdateProvider>
    );
    expect(html).toContain("UPDATE");
  });

  it("does not render after the update expires", () => {
    const html = renderToStaticMarkup(
      <TravelerUpdateProvider initialNow={Date.now()}>
        <LinkedUpdateBadge updates={[{ ...update, expiresAt: new Date(Date.now() - 60_000) }]} />
      </TravelerUpdateProvider>
    );
    expect(html).not.toContain("UPDATE");
  });
});
