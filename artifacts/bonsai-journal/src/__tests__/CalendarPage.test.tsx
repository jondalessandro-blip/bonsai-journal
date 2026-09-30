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
      "General guidance for cold-winter climates. Always go by what your tree is actually doing.",
    );
    expect(screen.queryByText("Build your calendar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("badge-this-month")).not.toBeInTheDocument();
  });

  it.each(["", "&month=", "&month=0", "&month=13", "&month=nope", "&month=1.5", "&month=03"])(
    "uses the current month for a missing or invalid month parameter (%s)",
    (monthQuery) => {
      renderCalendar(`/calendar?tab=guide${monthQuery}`);

      expect(screen.getByTestId("button-month-9")).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByTestId("button-month-9")).toHaveAttribute("aria-current", "date");
      expect(screen.getByTestId("marker-current-month-9")).toBeInTheDocument();
      expect(screen.getByTestId("text-guide-missing")).toHaveTextContent(
        "The guide for September is on its way.",
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
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveTextContent("Read the January guide");
    expect(links[1]).toHaveTextContent("Read the February guide");
    expect(links[2]).toHaveTextContent("Read the March guide");
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