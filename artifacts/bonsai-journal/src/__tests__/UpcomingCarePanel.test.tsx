import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { format } from "date-fns";
import type { UpcomingReminder } from "@workspace/api-client-react";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("@workspace/api-client-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/api-client-react")>();
  const { useMutation } = await import("@tanstack/react-query");
  return {
    ...actual,
    useCompleteRemindersBulk: () => useMutation({ mutationFn: request }),
  };
});

import { UpcomingCarePanel } from "@/components/UpcomingCarePanel";

const today = format(new Date(), "yyyy-MM-dd");
const reminders: UpcomingReminder[] = [
  { id: "a", treeId: "maple", treeName: "Maple", type: "Fertilizing", notes: "Half strength feed", dueDate: today, daysUntilDue: 0, completed: false, recurring: true },
  { id: "b", treeId: "maple", treeName: "Maple", type: "Fertilizing", notes: "Organic pellets", dueDate: "2026-01-01", daysUntilDue: -2, completed: false, recurring: false },
  { id: "c", treeId: "elm", treeName: "Elm", type: "Other", notes: "Rotate the pot", dueDate: today, daysUntilDue: 0, completed: false, recurring: false },
  { id: "d", treeId: "pine", treeName: "Pine", type: "Other", notes: "Check wiring", dueDate: "2099-01-01", daysUntilDue: 3, completed: false, recurring: true },
];
const clients: QueryClient[] = [];

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({ completedCount: 1, rescheduled: [] });
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach(client => client.clear());
  vi.restoreAllMocks();
});

async function setup(select = true) {
  const user = userEvent.setup();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  clients.push(client);
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const routing = memoryLocation({ path: "/", record: true });
  const wrap = (items: UpcomingReminder[]) => (
    <QueryClientProvider client={client}>
      <Router hook={routing.hook}><UpcomingCarePanel reminders={items} /></Router>
    </QueryClientProvider>
  );
  const view = render(wrap(reminders));
  await user.click(screen.getByRole("button", { name: "View all upcoming and overdue care tasks" }));
  if (select) await user.click(screen.getByRole("button", { name: "Select" }));
  return { user, routing, invalidate, ...view, rerenderItems: (items: UpcomingReminder[]) => view.rerender(wrap(items)) };
}

const checkbox = (id: string) => screen.getByTestId(`checkbox-care-${id}`);
const selectedCount = (n: number) => expect(screen.getByTestId("status-care-selected")).toHaveTextContent(`${n} selected`);

describe("Upcoming Care full-screen bulk completion", () => {
  it("keeps normal links and the collapsed banner unchanged; selection rows do not navigate", async () => {
    const { user, routing } = await setup(false);
    const overlay = screen.getByRole("dialog");
    expect(within(overlay).getAllByRole("link")).toHaveLength(4);
    expect(screen.getAllByRole("link")).toHaveLength(8);
    await user.click(screen.getByRole("button", { name: "Select" }));
    expect(within(overlay).queryAllByRole("link")).toHaveLength(0);
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
    expect(within(overlay).getByText("Half strength feed")).toHaveClass("line-clamp-2");
    await user.click(screen.getByTestId("row-care-a"));
    expect(checkbox("a")).toBeChecked();
    selectedCount(1);
    expect(routing.history).toEqual(["/"]);
    await user.click(checkbox("a"));
    expect(checkbox("a")).not.toBeChecked();
  });

  it("normal rows still navigate to the tree and release scroll lock", async () => {
    const { user, routing } = await setup(false);
    await user.click(within(screen.getByRole("dialog")).getAllByRole("link")[0]);
    expect(routing.history.at(-1)).toBe("/trees/maple");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("type chips select and deselect by type, not by notes", async () => {
    const { user } = await setup();
    await user.click(screen.getByRole("button", { name: "Fertilizing (2)" }));
    expect(checkbox("a")).toBeChecked();
    expect(checkbox("b")).toBeChecked();
    expect(checkbox("c")).not.toBeChecked();
    selectedCount(2);
    await user.click(screen.getByRole("button", { name: "Fertilizing (2)" }));
    selectedCount(0);
    await user.click(screen.getByRole("button", { name: "Other (2)" }));
    expect(checkbox("c")).toBeChecked();
    expect(checkbox("d")).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Clear" }));
    selectedCount(0);
  });

  it("search matches names, types and notes without clearing hidden selections", async () => {
    const { user } = await setup();
    await user.click(checkbox("c"));
    const search = screen.getByRole("searchbox");
    await user.type(search, "MAPLE");
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Other (0)" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Select all shown" }));
    selectedCount(3);
    await user.clear(search);
    await user.type(search, "pElLeTs");
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(checkbox("b")).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Fertilizing (1)" }));
    selectedCount(2);
    await user.clear(search);
    await user.type(search, "OTHER");
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(checkbox("c")).toBeChecked();
    selectedCount(2);
  });

  it("scheduled-date mode unticks and disables future tasks and helpers skip them", async () => {
    const { user } = await setup();
    await user.click(screen.getByRole("button", { name: "Select all shown" }));
    selectedCount(4);
    await user.click(screen.getByLabelText("On each task's scheduled date"));
    selectedCount(3);
    expect(checkbox("d")).toBeDisabled();
    expect(checkbox("d")).not.toBeChecked();
    expect(screen.getByTestId("row-care-d")).toHaveClass("opacity-45");
    expect(screen.getByText("Not due yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear" }));
    await user.click(screen.getByRole("button", { name: "Other (2)" }));
    selectedCount(1);
    expect(checkbox("c")).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Select all shown" }));
    selectedCount(3);
    await user.click(screen.getByTestId("row-care-d"));
    selectedCount(3);
    await user.click(screen.getByLabelText("Done on", { exact: true }));
    expect(checkbox("d")).toBeEnabled();
    await user.click(checkbox("d"));
    selectedCount(4);
  });

  it.each([false, true])("explains one automatically unticked task with other selection: %s", async (keepOtherSelected) => {
    const { user } = await setup();
    await user.click(checkbox("d"));
    if (keepOtherSelected) await user.click(checkbox("a"));
    await user.click(screen.getByLabelText("On each task's scheduled date"));

    const notice = screen.getByTestId("status-care-auto-unticked");
    expect(notice).toHaveAttribute("role", "status");
    expect(notice).toHaveTextContent(
      "1 task that is not yet due was unticked because it cannot be marked done on its scheduled date. Choosing Done on again will bring it back.",
    );
    selectedCount(keepOtherSelected ? 1 : 0);
    expect(checkbox("d")).not.toBeChecked();
    if (keepOtherSelected) expect(checkbox("a")).toBeChecked();
    if (keepOtherSelected) expect(screen.getByTestId("button-complete-care")).toBeEnabled();
    else expect(screen.getByTestId("button-complete-care")).toBeDisabled();
  });

  it.each([false, true])("explains multiple automatically unticked tasks with other selection: %s", async (keepOtherSelected) => {
    const { user, rerenderItems } = await setup();
    const extraFuture = { ...reminders[3], id: "e", treeName: "Juniper" };
    rerenderItems([...reminders, extraFuture]);
    await user.click(checkbox("d"));
    await user.click(checkbox("e"));
    if (keepOtherSelected) await user.click(checkbox("b"));
    await user.click(screen.getByLabelText("On each task's scheduled date"));

    expect(screen.getByTestId("status-care-auto-unticked")).toHaveTextContent(
      "2 tasks that are not yet due were unticked because they cannot be marked done on their scheduled dates. Choosing Done on again will bring them back.",
    );
    selectedCount(keepOtherSelected ? 1 : 0);
    expect(checkbox("d")).not.toBeChecked();
    expect(checkbox("e")).not.toBeChecked();
    if (!keepOtherSelected) expect(screen.getByTestId("button-complete-care")).toBeDisabled();
  });

  it("restores exactly the automatically unticked tasks and removes the notice on Done on", async () => {
    const { user, rerenderItems } = await setup();
    rerenderItems([...reminders, { ...reminders[3], id: "e", treeName: "Juniper" }]);
    await user.click(checkbox("b"));
    await user.click(checkbox("d"));
    await user.click(screen.getByLabelText("On each task's scheduled date"));
    await user.click(screen.getByLabelText("Done on", { exact: true }));
    selectedCount(2);
    for (const id of ["b", "d"]) expect(checkbox(id)).toBeChecked();
    for (const id of ["a", "c", "e"]) expect(checkbox(id)).not.toBeChecked();
    expect(screen.queryByTestId("status-care-auto-unticked")).not.toBeInTheDocument();

    // A later switch must remember only the new selection, not the previous one.
    await user.click(checkbox("d"));
    await user.click(screen.getByLabelText("On each task's scheduled date"));
    expect(screen.queryByTestId("status-care-auto-unticked")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Done on", { exact: true }));
    expect(checkbox("d")).not.toBeChecked();
    selectedCount(1);
  });

  it("preserves manual additions and removals made in scheduled-date mode", async () => {
    const { user } = await setup();
    await user.click(checkbox("a"));
    await user.click(checkbox("d"));
    await user.click(screen.getByLabelText("On each task's scheduled date"));
    await user.click(checkbox("a"));
    await user.click(checkbox("b"));
    await user.click(screen.getByLabelText("Done on", { exact: true }));

    expect(checkbox("a")).not.toBeChecked();
    expect(checkbox("b")).toBeChecked();
    expect(checkbox("c")).not.toBeChecked();
    expect(checkbox("d")).toBeChecked();
    selectedCount(2);
    expect(screen.queryByTestId("status-care-auto-unticked")).not.toBeInTheDocument();
  });

  it("counts only remembered tasks still in the list and does not restore removed tasks", async () => {
    const { user, rerenderItems } = await setup();
    const extraFuture = { ...reminders[3], id: "e", treeName: "Juniper" };
    rerenderItems([...reminders, extraFuture]);
    await user.click(checkbox("d"));
    await user.click(checkbox("e"));
    await user.click(screen.getByLabelText("On each task's scheduled date"));
    rerenderItems(reminders);
    expect(screen.getByTestId("status-care-auto-unticked")).toHaveTextContent("1 task that is not yet due was unticked");
    rerenderItems(reminders.slice(0, 3));
    expect(screen.queryByTestId("status-care-auto-unticked")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Done on", { exact: true }));
    selectedCount(0);
    rerenderItems([...reminders, extraFuture]);
    expect(checkbox("d")).not.toBeChecked();
    expect(checkbox("e")).not.toBeChecked();
  });

  it.each(["Clear", "Done selecting", "Escape", "Close full-screen view", "completion"])(
    "%s forgets automatically unticked tasks",
    async (reset) => {
      const { user } = await setup();
      await user.click(checkbox("d"));
      if (reset === "completion") await user.click(checkbox("a"));
      await user.click(screen.getByLabelText("On each task's scheduled date"));
      expect(screen.getByTestId("status-care-auto-unticked")).toBeInTheDocument();

      if (reset === "Escape") await user.keyboard("{Escape}");
      else if (reset === "completion") {
        await user.click(screen.getByRole("button", { name: "Mark 1 done" }));
        expect(await screen.findByText("Marked 1 task done.")).toBeInTheDocument();
      } else await user.click(screen.getByRole("button", { name: reset }));

      expect(screen.queryByTestId("status-care-auto-unticked")).not.toBeInTheDocument();
      if (reset === "Close full-screen view") {
        await user.click(screen.getByRole("button", { name: "View all upcoming and overdue care tasks" }));
      }
      if (reset !== "Clear") await user.click(screen.getByRole("button", { name: "Select" }));
      await user.click(screen.getByLabelText("Done on", { exact: true }));
      selectedCount(0);
      expect(checkbox("d")).not.toBeChecked();
      expect(screen.getByTestId("button-complete-care")).toBeDisabled();
      await user.click(screen.getByLabelText("On each task's scheduled date"));
      expect(screen.queryByTestId("status-care-auto-unticked")).not.toBeInTheDocument();
      await user.click(screen.getByLabelText("Done on", { exact: true }));
      selectedCount(0);
    },
  );

  it.each([false, true])("shows no notice when no task was automatically unticked, with due selection: %s", async (selectDue) => {
    const { user } = await setup();
    if (selectDue) await user.click(checkbox("a"));
    await user.click(screen.getByLabelText("On each task's scheduled date"));
    expect(screen.queryByTestId("status-care-auto-unticked")).not.toBeInTheDocument();
    selectedCount(selectDue ? 1 : 0);
  });

  it("requires a date no later than local today and submits one task without confirmation", async () => {
    const { user, invalidate } = await setup();
    const dateInput = screen.getByLabelText("Done on date");
    expect(dateInput).toHaveValue(today);
    expect(dateInput).toHaveAttribute("max", today);
    expect(dateInput).toBeRequired();
    expect(screen.getByRole("button", { name: "Mark 0 done" })).toBeDisabled();
    await user.click(checkbox("d"));
    fireEvent.change(dateInput, { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Mark 1 done" })).toBeDisabled();
    fireEvent.change(dateInput, { target: { value: "2099-01-01" } });
    expect(screen.getByRole("button", { name: "Mark 1 done" })).toBeDisabled();
    fireEvent.change(dateInput, { target: { value: "2026-01-01" } });
    await user.click(screen.getByRole("button", { name: "Mark 1 done" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(request.mock.calls[0][0]).toEqual({
      data: { reminderIds: ["d"], dateMode: "single", date: "2026-01-01", today },
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(await screen.findByText("Marked 1 task done.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select" })).toBeInTheDocument();
    for (const key of ["/api/reminders/upcoming", "/api/trees", "/api/collection/stats"]) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: [key] });
    }
  });

  it("confirms multiple tasks with distinct trees, type counts, date and recurring counts", async () => {
    const { user } = await setup();
    await user.click(screen.getByRole("button", { name: "Select all shown" }));
    fireEvent.change(screen.getByLabelText("Done on date"), { target: { value: "2026-01-01" } });
    await user.click(screen.getByRole("button", { name: "Mark 4 done" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByRole("heading")).toHaveTextContent("Mark 4 tasks done?");
    expect(dialog).toHaveTextContent("4 tasks across 3 trees.");
    expect(dialog).toHaveTextContent("Fertilizing x 2, Other x 2");
    expect(dialog).toHaveTextContent("Completion date: Jan 1.");
    expect(dialog).toHaveTextContent("2 of these repeat and will be rescheduled.");
    expect(request).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    selectedCount(4);
    await user.click(screen.getByRole("button", { name: "Mark 4 done" }));
    await user.click(screen.getByRole("button", { name: "Mark done" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(request.mock.calls[0][0]).toEqual({
      data: { reminderIds: ["a", "b", "c", "d"], dateMode: "single", date: "2026-01-01", today },
    });
  });

  it("omits the recurring line for non-repeating tasks and sends no date in scheduled mode", async () => {
    const { user } = await setup();
    await user.click(checkbox("b"));
    await user.click(checkbox("c"));
    await user.click(screen.getByLabelText("On each task's scheduled date"));
    await user.click(screen.getByRole("button", { name: "Mark 2 done" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("2 tasks across 2 trees.");
    expect(dialog).toHaveTextContent("Fertilizing x 1, Other x 1");
    expect(dialog).toHaveTextContent("each task's scheduled date");
    expect(dialog).not.toHaveTextContent("repeat");
    await user.click(within(dialog).getByRole("button", { name: "Mark done" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(request.mock.calls[0][0]).toEqual({
      data: { reminderIds: ["b", "c"], dateMode: "scheduled", today },
    });
    expect(request.mock.calls[0][0].data).not.toHaveProperty("date");
  });

  it("keeps confirmation and selection on failure, prevents dismissal while pending, and supports retry", async () => {
    let reject!: (error: Error) => void;
    request.mockImplementationOnce(() => new Promise((_, rejectRequest) => { reject = rejectRequest; }));
    const { user } = await setup();
    await user.click(checkbox("a"));
    await user.click(checkbox("b"));
    await user.click(screen.getByRole("button", { name: "Mark 2 done" }));
    await user.click(screen.getByRole("button", { name: "Mark done" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Marking done..." })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await act(async () => reject(new Error("A task was already completed. Please refresh.")));
    expect(await screen.findByRole("alert")).toHaveTextContent("A task was already completed. Please refresh.");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(checkbox("a")).toBeChecked();
    expect(checkbox("b")).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Mark done" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("keeps a single-task selection on failure", async () => {
    request.mockRejectedValueOnce(new Error("Please refresh."));
    const { user } = await setup();
    await user.click(checkbox("a"));
    await user.click(screen.getByRole("button", { name: "Mark 1 done" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Please refresh.");
    expect(checkbox("a")).toBeChecked();
    selectedCount(1);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("Escape leaves selection first, then closes; close and Done selecting also clear it", async () => {
    const { user } = await setup();
    expect(document.body.style.overflow).toBe("hidden");
    await user.click(checkbox("a"));
    await user.keyboard("{Escape}");
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Select" }));
    selectedCount(0);
    await user.click(checkbox("a"));
    await user.click(screen.getByRole("button", { name: "Done selecting" }));
    await user.click(screen.getByRole("button", { name: "Select" }));
    selectedCount(0);
    await user.click(checkbox("b"));
    await user.click(screen.getByRole("button", { name: "Close full-screen view" }));
    expect(document.body.style.overflow).toBe("");
    await user.click(screen.getByRole("button", { name: "View all upcoming and overdue care tasks" }));
    await user.click(screen.getByRole("button", { name: "Select" }));
    selectedCount(0);
    await user.keyboard("{Escape}");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("releases scroll lock when the last reminder disappears or the panel unmounts", async () => {
    const { rerenderItems, unmount } = await setup();
    expect(document.body.style.overflow).toBe("hidden");
    rerenderItems([]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    unmount();
    const second = await setup();
    expect(document.body.style.overflow).toBe("hidden");
    second.unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
