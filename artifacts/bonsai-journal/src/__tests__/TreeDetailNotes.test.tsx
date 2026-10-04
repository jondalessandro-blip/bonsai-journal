import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import type { Tree } from "@workspace/api-client-react";

const { trees, updateTreeRequest } = vi.hoisted(() => ({
  trees: {} as Record<string, Tree>,
  updateTreeRequest: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/api-client-react")>();
  const { useQuery, useMutation } = await import("@tanstack/react-query");
  const unusedMutation = () => ({ mutate: vi.fn(), isPending: false });
  return {
    ...actual,
    listTrees: async () => Object.values(trees),
    useGetTree: (id: string) => useQuery({
      queryKey: ["/api/trees", id],
      queryFn: async () => ({ ...trees[id] }),
    }),
    useGetTreeTimeline: () => ({ data: [] }),
    useUpdateTree: () => useMutation({
      mutationFn: (input: { id: string; data: { notes: string } }) => updateTreeRequest(input),
    }),
    useDeleteTree: unusedMutation,
    useUpdateTreeReminder: unusedMutation,
    useCreateTreeLog: unusedMutation,
    useUpdateTreeLog: unusedMutation,
    useDeleteTreeLog: unusedMutation,
    useDeleteTreeReminder: unusedMutation,
  };
});

vi.mock("@/components/CoverPhotoHero", () => ({ CoverPhotoHero: () => null }));
vi.mock("@/components/ProgressionGallery", () => ({ ProgressionGallery: () => null }));
vi.mock("@/components/TreeForm", () => ({ TreeForm: () => null }));
vi.mock("@/components/LogForm", () => ({ LogForm: () => null }));
vi.mock("@/components/ReminderForm", () => ({ ReminderForm: () => null }));
vi.mock("@/pages/NewTreePage", () => ({ buildTreePrefill: () => ({}) }));

import TreeDetailPage from "@/pages/TreeDetailPage";

const overlayName = "Notes (Markdown supported) — full view";
const clients: QueryClient[] = [];

beforeEach(() => {
  trees["tree-1"] = {
    id: "tree-1",
    name: "Maple",
    notes: "Original maple notes",
    tags: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  trees["tree-2"] = { ...trees["tree-1"], id: "tree-2", name: "Elm", notes: "Elm notes" };
  updateTreeRequest.mockReset();
  updateTreeRequest.mockImplementation(async ({ id, data }: { id: string; data: { notes: string } }) => {
    trees[id] = { ...trees[id], ...data };
    return trees[id];
  });
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.restoreAllMocks();
});

async function renderTree() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  const invalidateQueries = vi.spyOn(client, "invalidateQueries");
  const routing = memoryLocation({ path: "/trees/tree-1", record: true });
  render(
    <QueryClientProvider client={client}>
      <Router hook={routing.hook}>
        <Route path="/trees/:id" component={TreeDetailPage} />
      </Router>
    </QueryClientProvider>,
  );
  await screen.findByRole("button", { name: "Expand notes to full screen" });
  return { client, invalidateQueries, routing };
}

async function editNotes(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Expand notes to full screen" }));
  await user.click(screen.getByRole("button", { name: "Edit notes" }));
  return screen.getByRole("textbox", { name: "Notes" });
}

describe("Tree detail expanded Notes editing", () => {
  it("focuses the current notes and saves only notes, updating both views without closing", async () => {
    const user = userEvent.setup();
    const { client, invalidateQueries } = await renderTree();
    const textarea = await editNotes(user);
    expect(textarea).toHaveValue("Original maple notes");
    expect(textarea).toHaveFocus();
    expect(textarea).toHaveClass("text-base", "flex-1");

    fireEvent.change(textarea, { target: { value: "**Saved expanded notes**" } });
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Notes" })).toBeNull());
    expect(updateTreeRequest).toHaveBeenCalledWith({ id: "tree-1", data: { notes: "**Saved expanded notes**" } });
    const overlay = screen.getByRole("dialog", { name: overlayName });
    expect(within(overlay).getByText("Saved expanded notes").tagName).toBe("STRONG");
    expect(screen.getAllByText("Saved expanded notes")).toHaveLength(2);
    expect(client.getQueryData<Tree>(["/api/trees", "tree-1"])?.notes).toBe("**Saved expanded notes**");
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["/api/trees", "tree-1"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["/api/trees"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["/api/trees", "tree-1", "timeline"] });

    await user.click(within(overlay).getByRole("button", { name: "Close full-screen notes" }));
    expect(screen.queryByRole("dialog", { name: overlayName })).toBeNull();
    expect(screen.getByText("Saved expanded notes")).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("discards edits on Cancel and Escape while leaving the overlay open", async () => {
    const user = userEvent.setup();
    await renderTree();
    const textarea = await editNotes(user);
    fireEvent.change(textarea, { target: { value: "Discard this draft" } });
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("dialog", { name: overlayName })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Notes" })).toBeNull();
    expect(document.body.style.overflow).toBe("hidden");

    await user.click(screen.getByRole("button", { name: "Edit notes" }));
    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveValue("Original maple notes");
    await user.type(screen.getByRole("textbox", { name: "Notes" }), " unsaved");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: overlayName })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit notes" })).toBeInTheDocument();
    expect(updateTreeRequest).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: overlayName })).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("guards X with unsaved text, preserves it on prompt Cancel, and discards it on Discard", async () => {
    const user = userEvent.setup();
    await renderTree();
    const textarea = await editNotes(user);
    fireEvent.change(textarea, { target: { value: "Keep this draft" } });
    await user.click(screen.getByRole("button", { name: "Close full-screen notes" }));
    const guard = screen.getByRole("alertdialog", { name: "Unsaved changes" });
    await user.click(within(guard).getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveValue("Keep this draft");

    await user.click(screen.getByRole("button", { name: "Close full-screen notes" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.queryByRole("dialog", { name: overlayName })).toBeNull();
    expect(screen.getByText("Original maple notes")).toBeInTheDocument();
    expect(updateTreeRequest).not.toHaveBeenCalled();

    expect(await editNotes(user)).toHaveValue("Original maple notes");
  });

  it("saves and closes through Save & Leave in the unsaved-changes prompt", async () => {
    const user = userEvent.setup();
    await renderTree();
    fireEvent.change(await editNotes(user), { target: { value: "Saved before closing" } });
    await user.click(screen.getByRole("button", { name: "Close full-screen notes" }));
    await user.click(screen.getByRole("button", { name: "Save & Leave" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: overlayName })).toBeNull());
    expect(screen.getByText("Saved before closing")).toBeInTheDocument();
    expect(updateTreeRequest).toHaveBeenCalledWith({ id: "tree-1", data: { notes: "Saved before closing" } });
  });

  it("sends an empty string to clear notes and closes the overlay and small panel", async () => {
    const user = userEvent.setup();
    const { client } = await renderTree();
    fireEvent.change(await editNotes(user), { target: { value: "" } });
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: overlayName })).toBeNull());
    expect(updateTreeRequest).toHaveBeenCalledWith({ id: "tree-1", data: { notes: "" } });
    expect(client.getQueryData<Tree>(["/api/trees", "tree-1"])?.notes).toBe("");
    expect(screen.queryByRole("button", { name: "Expand notes to full screen" })).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("shows a disabled busy Save and retains the draft after a failed save", async () => {
    const user = userEvent.setup();
    let rejectSave!: (error: Error) => void;
    updateTreeRequest.mockImplementationOnce(() => new Promise((_, reject) => { rejectSave = reject; }));
    await renderTree();
    const textarea = await editNotes(user);
    fireEvent.change(textarea, { target: { value: "Do not lose this text" } });
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(textarea).toHaveAttribute("readonly");

    await act(async () => rejectSave(new Error("Network failure")));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your text is still here");
    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveValue("Do not lose this text");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(screen.getByRole("dialog", { name: overlayName })).toBeInTheDocument();
  });

  it("resets the editor when moving to another tree", async () => {
    const user = userEvent.setup();
    const { routing } = await renderTree();
    fireEvent.change(await editNotes(user), { target: { value: "Maple-only draft" } });
    act(() => routing.navigate("/trees/tree-2"));
    await screen.findByRole("heading", { name: "Elm", level: 1 });
    expect(screen.queryByRole("dialog", { name: overlayName })).toBeNull();
    expect(await editNotes(user)).toHaveValue("Elm notes");
    expect(updateTreeRequest).not.toHaveBeenCalled();
  });
});