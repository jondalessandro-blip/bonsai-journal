import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import CalendarPage from "@/pages/CalendarPage";

function renderCalendar(path = "/calendar") {
  const routing = memoryLocation({ path, record: true });
  render(
    <Router hook={routing.hook}>
      <CalendarPage />
    </Router>,
  );
  return routing;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-30T12:00:00"));
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Care Calendar tabs", () => {
  it("defaults to the unchanged Calendar view without a tab parameter", () => {
    renderCalendar();

    expect(screen.getByRole("tab", { name: "Calendar" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Build your calendar")).toBeInTheDocument();
    expect(screen.getByText("Your year at a glance")).toBeInTheDocument();
    expect(screen.queryByTestId("monthly-guide-panel")).not.toBeInTheDocument();
  });

  it("opens January directly from the web address and displays its complete guide", () => {
    renderCalendar("/calendar?tab=guide&month=1");

    expect(screen.getByRole("tab", { name: "Monthly Guide" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("button-month-1")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "January Bonsai Checklist" })).toBeInTheDocument();
    expect(screen.getByTestId("text-guide-intro")).toHaveTextContent(
      "January is generally the heart of winter",
    );
    expect(screen.getAllByTestId(/^section-guide-/)).toHaveLength(4);
    expect(screen.getByTestId("callout-guide-focus")).toHaveTextContent("January focus");
    expect(screen.getByTestId("text-guide-disclaimer")).toHaveTextContent(
      "Written for cold-winter climates, so timing may differ where you live.",
    );
    expect(screen.queryByText("Build your calendar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("badge-this-month")).not.toBeInTheDocument();
  });

  it("changes the intro text with the selected tab", async () => {
    const user = userEvent.setup();
    renderCalendar();

    const calendarIntro =
      "These are typical timings for your climate zone. Dates are approximate, so always go by what your tree is actually doing.";
    const guideIntro =
      "General month-by-month guidance for cold-winter climates. Timing varies with your region and the season, so always go by what your trees are actually doing.";

    expect(screen.getByText(calendarIntro)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Monthly Guide" }));
    expect(screen.getByText(guideIntro)).toBeInTheDocument();
    expect(screen.queryByText(calendarIntro)).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Calendar" }));
    expect(screen.getByText(calendarIntro)).toBeInTheDocument();
    expect(screen.queryByText(guideIntro)).not.toBeInTheDocument();
  });

  it.each(["", "&month=", "&month=0", "&month=13", "&month=nope", "&month=1.5", "&month=03"])(
    "uses the current month for a missing or invalid month parameter (%s)",
    (monthQuery) => {
      renderCalendar(`/calendar?tab=guide${monthQuery}`);

      expect(screen.getByTestId("button-month-9")).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByTestId("button-month-9")).toHaveAttribute("aria-current", "date");
      expect(screen.getByTestId("marker-current-month-9")).toBeInTheDocument();
      expect(screen.getByTestId("text-guide-title")).toHaveTextContent(
        "September Bonsai Checklist",
      );
    },
  );

  it("shows the This month badge when the guide is for the current month", () => {
    vi.setSystemTime(new Date("2026-01-15T12:00:00"));
    renderCalendar("/calendar?tab=guide&month=1");

    expect(screen.getByTestId("badge-this-month")).toHaveTextContent("This month");
    expect(screen.getByTestId("marker-current-month-1")).toBeInTheDocument();
  });

  it("changes months through the URL without adding history entries", async () => {
    const user = userEvent.setup();
    const routing = renderCalendar("/calendar?tab=guide&month=1&source=test");

    await user.click(screen.getByTestId("button-month-12"));

    expect(screen.getByTestId("text-guide-missing")).toHaveTextContent(
      "The guide for December is on its way.",
    );
    expect(screen.getByTestId("button-month-12")).toHaveAttribute("aria-pressed", "true");
    expect(routing.history).toHaveLength(1);
    const params = new URLSearchParams(routing.history![0].split("?")[1]);
    expect(params.get("tab")).toBe("guide");
    expect(params.get("month")).toBe("12");
    expect(params.get("source")).toBe("test");
  });

  it("keeps the zone, groups, advanced-task choice and guide month while switching tabs", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      "bonsai:careCalendar",
      JSON.stringify({ zoneId: "7a", groupIds: ["hardy_deciduous"], includeOptional: false }),
    );
    const routing = renderCalendar("/calendar?month=1");
    const zoneLabel = screen.getByRole("combobox").textContent;

    await user.click(document.getElementById("calendar-group-pine_two_flush")!);
    await user.click(screen.getByRole("switch"));
    await user.click(screen.getByRole("tab", { name: "Monthly Guide" }));
    expect(screen.getByTestId("text-guide-title")).toHaveTextContent("January Bonsai Checklist");
    await user.click(screen.getByRole("tab", { name: "Calendar" }));

    expect(screen.getByRole("combobox")).toHaveTextContent(zoneLabel!);
    expect(document.getElementById("calendar-group-hardy_deciduous")).toBeChecked();
    expect(document.getElementById("calendar-group-pine_two_flush")).toBeChecked();
    expect(screen.getByRole("switch")).toBeChecked();
    expect(routing.history).toHaveLength(1);
    const params = new URLSearchParams(routing.history![0].split("?")[1]);
    expect(params.has("tab")).toBe(false);
    expect(params.get("month")).toBe("1");
  });

  it("links only written guides from month headers and scrolls to the top", async () => {
    const user = userEvent.setup();
    const routing = renderCalendar();

    const links = screen.getAllByRole("link", { name: /^Read the .+ guide$/ });
    expect(links).toHaveLength(10);
    expect(links[0]).toHaveTextContent("Read the January guide");
    expect(links[1]).toHaveTextContent("Read the February guide");
    expect(links[2]).toHaveTextContent("Read the March guide");
    expect(links[3]).toHaveTextContent("Read the April guide");
    expect(links[4]).toHaveTextContent("Read the May guide");
    expect(links[5]).toHaveTextContent("Read the June guide");
    expect(links[6]).toHaveTextContent("Read the July guide");
    expect(links[7]).toHaveTextContent("Read the August guide");
    expect(links[8]).toHaveTextContent("Read the September guide");
    expect(links[9]).toHaveTextContent("Read the October guide");
    expect(screen.queryByRole("link", { name: "Read the December guide" })).not.toBeInTheDocument();
    await user.click(links[0]);

    expect(screen.getByTestId("text-guide-title")).toHaveTextContent("January Bonsai Checklist");
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(routing.history).toEqual(["/calendar?tab=guide&month=1"]);
  });

  it("opens February from its month header link", async () => {
    const user = userEvent.setup();
    const routing = renderCalendar();

    await user.click(screen.getByRole("link", { name: "Read the February guide" }));

    expect(screen.getByTestId("text-guide-title")).toHaveTextContent("February Bonsai Checklist");
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(routing.history).toEqual(["/calendar?tab=guide&month=2"]);
  });

  it("opens March from its month header link", async () => {
    const user = userEvent.setup();
    const routing = renderCalendar();

    await user.click(screen.getByRole("link", { name: "Read the March guide" }));

    expect(screen.getByTestId("text-guide-title")).toHaveTextContent("March Bonsai Checklist");
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(routing.history).toEqual(["/calendar?tab=guide&month=3"]);
  });

  it("opens April from its month header link", async () => {
    const user = userEvent.setup();
    const routing = renderCalendar();

    await user.click(screen.getByRole("link", { name: "Read the April guide" }));

    expect(screen.getByTestId("text-guide-title")).toHaveTextContent("April Bonsai Checklist");
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(routing.history).toEqual(["/calendar?tab=guide&month=4"]);
  });

  it("opens May from its month header link", async () => {
    const user = userEvent.setup();
    const routing = renderCalendar();

    await user.click(screen.getByRole("link", { name: "Read the May guide" }));

    expect(screen.getByTestId("text-guide-title")).toHaveTextContent("May Bonsai Checklist");
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(routing.history).toEqual(["/calendar?tab=guide&month=5"]);
  });

  it("opens June from its month header link", async () => {
    const user = userEvent.setup();
    const routing = renderCalendar();

    await user.click(screen.getByRole("link", { name: "Read the June guide" }));

    expect(screen.getByTestId("text-guide-title")).toHaveTextContent("June Bonsai Checklist");
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(routing.history).toEqual(["/calendar?tab=guide&month=6"]);
  });

  it("opens July from its month header link", async () => {
    const user = userEvent.setup();
    const routing = renderCalendar();

    await user.click(screen.getByRole("link", { name: "Read the July guide" }));

    expect(screen.getByTestId("text-guide-title")).toHaveTextContent("July Bonsai Checklist");
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(routing.history).toEqual(["/calendar?tab=guide&month=7"]);
  });

  it("responds to tab and month changes made through navigation", () => {
    const routing = renderCalendar();

    act(() => routing.navigate("/calendar?tab=guide&month=1"));
    expect(screen.getByTestId("text-guide-title")).toHaveTextContent("January Bonsai Checklist");
    act(() => routing.navigate("/calendar?tab=guide&month=12"));
    expect(screen.getByTestId("text-guide-missing")).toHaveTextContent(
      "The guide for December is on its way.",
    );
    act(() => routing.navigate("/calendar"));
    expect(screen.getByText("Build your calendar")).toBeInTheDocument();
  });
});