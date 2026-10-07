import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { photos, updateTreeMutation } = vi.hoisted(() => ({
  photos: [] as { photoUrl: string }[],
  updateTreeMutation: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => ({
  useListTreePhotos: () => ({ data: photos }),
  useUpdateTree: () => ({ mutate: updateTreeMutation, isPending: false }),
}));

import { CoverPhotoHero } from "@/components/CoverPhotoHero";

function renderHero() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <CoverPhotoHero treeId="tree-1" />
    </QueryClientProvider>,
  );
}

describe("CoverPhotoHero zoom controls", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    localStorage.clear();
    photos.splice(0, photos.length, { photoUrl: "/cover.jpg" });
    updateTreeMutation.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("steps by 25 percent and disables zoom buttons at both ends", async () => {
    const user = userEvent.setup();
    renderHero();

    await user.click(screen.getByRole("button", { name: "Reposition" }));

    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    const zoomOut = screen.getByRole("button", { name: "Zoom out" });
    const readout = screen.getByTestId("text-cover-zoom");

    expect(readout).toHaveTextContent("100%");
    expect(zoomOut).toBeDisabled();

    await user.click(zoomIn);
    expect(readout).toHaveTextContent("125%");
    await user.click(zoomIn);
    expect(readout).toHaveTextContent("150%");

    for (let step = 0; step < 4; step += 1) {
      await user.click(zoomIn);
    }
    expect(readout).toHaveTextContent("250%");
    expect(zoomIn).toBeDisabled();

    await user.click(zoomOut);
    expect(readout).toHaveTextContent("225%");
    for (let step = 0; step < 5; step += 1) {
      await user.click(zoomOut);
    }
    expect(readout).toHaveTextContent("100%");
    expect(zoomOut).toBeDisabled();
  });

  it("floors saved zoom below 100 percent and always uses cover positioning", async () => {
    localStorage.setItem(
      "bonsai-cover-tree-1",
      JSON.stringify({ x: 30, y: 70, zoom: 0.75 }),
    );
    renderHero();

    const image = screen.getByRole("img", { name: "Cover photo" });
    expect(image).toHaveStyle({
      objectFit: "cover",
      objectPosition: "30% 70%",
      transform: "scale(1)",
    });

    await userEvent.setup().click(screen.getByRole("button", { name: "Reposition" }));
    expect(screen.getByTestId("text-cover-zoom")).toHaveTextContent("100%");
  });
});
