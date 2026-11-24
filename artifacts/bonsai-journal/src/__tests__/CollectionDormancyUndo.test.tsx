import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import type { Tree } from "@workspace/api-client-react";

const { trees, changeRequest, undoRequest } = vi.hoisted(() => ({
  trees: [] as Tree[],
  changeRequest: vi.fn(),
  undoRequest: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/api-client-react")>();
  const { useMutation } = await import("@tanstack/react-query");
  return {
    ...actual,
    listTrees: async () => trees,
    useListUpcomingReminders: () => ({ data: [] }),
    useSetTreesDormancyBulk: () => useMutation({ mutationFn: changeRequest }),
    useUndoTreesDormancy: () => useMutation({ mutationFn: undoRequest }),
  };
});

vi.mock("@/components/TreeCard", () => ({
  TreeCard: ({ tree, isSelected, onToggleSelect }: {
    tree: Tree;
    isSelected: boolean;
    onToggleSelect: () => void;
  }) => (
    <button type="button" aria-label={`Select ${tree.name}`} onClick={onToggleSelect}>
      {tree.name} {isSelected ? "selected" : ""}
    </button>
  ),
}));

vi.mock("@/components/TreeGridTile", () => ({
  TreeGridTile: ({ tree, isSelected, onToggleSelect }: {
    tree: Tree;
    isSelected: boolean;
    onToggleSelect: () => void;
  }) => (
    <button type="button" aria-label={`Select ${tree.name}`} onClick={onToggleSelect}>
      {tree.name} {isSelected ? "selected" : ""}
    </button>
  ),
}));

import CollectionPage from "@/pages/CollectionPage";
import { Toaster } from "@/components/ui/toaster";

let client: QueryClient;
let stopIntersectionObserver: (() => void) | undefined;

beforeEach(() => {
  trees.splice(0, trees.length, {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Maple",
    tags: [],
    status: "Healthy",
    isDormant: false,
    dormantSince: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  changeRequest.mockReset();
  changeRequest.mockImplementation(async ({ data }: { data: { treeIds: string[]; dormant: boolean } }) => {
    const tree = trees.find(({ id }) => id === data.treeIds[0])!;
    const previous = { isDormant: tree.isDormant, dormantSince: tree.dormantSince };
    Object.assign(tree, {
      isDormant: data.dormant,
      dormantSince: data.dormant ? "2026-11-23T12:00:00.000Z" : null,
    });
    return {
      updatedCount: 1,
      undoItems: [{
        treeId: tree.id,
        logId: "22222222-2222-4222-8222-222222222222",
        previousIsDormant: previous.isDormant,
        previousDormantSince: previous.dormantSince,
        resultingIsDormant: data.dormant,
        resultingDormantSince: tree.dormantSince,
        expectedUpdatedAt: "2026-11-23T12:00:00.000Z",
      }],
    };
  });
  undoRequest.mockReset();
  undoRequest.mockImplementation(async ({ data }: { data: { items: Array<Record<string, any>> } }) => {
    for (const item of data.items) {
      const tree = trees.find(({ id }) => id === item.treeId)!;
      Object.assign(tree, {
        isDormant: item.previousIsDormant,
        dormantSince: item.previousDormantSince,
      });
    }
    return { restoredCount: data.items.length };
  });

  const OriginalIntersectionObserver = window.IntersectionObserver;
  class EmptyIntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  }
  window.IntersectionObserver = EmptyIntersectionObserver as unknown as typeof IntersectionObserver;
  stopIntersectionObserver = () => {
    window.IntersectionObserver = OriginalIntersectionObserver;
  };
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

afterEach(() => {
  cleanup();
  client.clear();
  stopIntersectionObserver?.();
  stopIntersectionObserver = undefined;
});

describe("collection bulk dormancy Undo", () => {
  it("shows Undo after a bulk action and submits the server-provided restore data", async () => {
    const user = userEvent.setup();
    const routing = memoryLocation({ path: "/", record: true });
    render(
      <QueryClientProvider client={client}>
        <Router hook={routing.hook}>
          <CollectionPage />
        </Router>
        <Toaster />
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole("button", { name: /^Select$/ }));
    await user.click(screen.getAllByRole("button", { name: "Select Maple" })[0]);
    await user.click(screen.getByRole("button", { name: "Begin dormancy" }));

    expect(await screen.findByText("Dormancy started.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => expect(undoRequest).toHaveBeenCalledTimes(1));
    expect(undoRequest.mock.calls[0][0]).toEqual({
      data: {
        items: [expect.objectContaining({
          treeId: "11111111-1111-4111-8111-111111111111",
          previousIsDormant: false,
          previousDormantSince: null,
        })],
      },
    });
    expect(trees[0]).toMatchObject({ isDormant: false, dormantSince: null });
  });
});
