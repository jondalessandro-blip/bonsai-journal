import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before any imports that transitively pull them in.
// ---------------------------------------------------------------------------

// Mock navigation guard so it never intercepts in the test environment.
vi.mock("@/hooks/use-navigation-guard", () => ({
  useNavigationGuard: vi.fn(),
}));

// Mock photo upload hook (not exercised by this test).
vi.mock("@/hooks/use-photo-upload", () => ({
  usePhotoUpload: () => ({
    uploadPhoto: vi.fn(),
    isUploading: false,
    progress: 0,
    error: null,
  }),
}));

// Stub Lightbox so it doesn't need real DOM metrics.
vi.mock("@/components/Lightbox", () => ({
  Lightbox: () => null,
}));

// ---------------------------------------------------------------------------
// Shared mutation mock refs (created with vi.hoisted so they can be referenced
// inside the vi.mock factory below without hoisting issues).
// ---------------------------------------------------------------------------
const { mockUpdateMutate, mockDeleteMutate, mockInvalidateQueries } = vi.hoisted(() => ({
  mockUpdateMutate: vi.fn(),
  mockDeleteMutate: vi.fn(),
  mockInvalidateQueries: vi.fn(),
}));

// Mock the entire api-client-react so no real HTTP calls are made.
vi.mock("@workspace/api-client-react", () => {
  const photo = {
    id: "photo-1",
    treeId: "tree-abc",
    photoUrl: "https://example.com/photo.jpg",
    photoThumb: null,
    takenAt: "2024-03-15",
    createdAt: "2024-03-15T00:00:00Z",
  };

  return {
    useListTreePhotos: () => ({ data: [photo], isLoading: false }),
    useCreateTreePhoto: () => ({ mutate: vi.fn(), isPending: false }),
    useUpdateTreePhoto: () => ({ mutate: mockUpdateMutate, isPending: false }),
    useDeleteTreePhoto: () => ({ mutate: mockDeleteMutate, isPending: false }),
    useUpdateTree: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

// Mock useQueryClient so invalidateQueries is observable.
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
  };
});

// ---------------------------------------------------------------------------
// The component under test — imported AFTER all mocks are registered.
// ---------------------------------------------------------------------------
import { ProgressionGallery } from "@/components/ProgressionGallery";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderGallery() {
  const client = makeClient();
  return render(
    <QueryClientProvider client={client}>
      <ProgressionGallery treeId="tree-abc" />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ProgressionGallery — date edit flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: mutate calls onSuccess immediately so state updates complete.
    mockUpdateMutate.mockImplementation(
      (_vars: unknown, opts: { onSuccess?: () => void }) => {
        opts?.onSuccess?.();
      },
    );
  });

  it("renders the initial photo date", () => {
    renderGallery();
    expect(screen.getByText("Mar 15, 2024")).toBeInTheDocument();
  });

  it("enters edit mode when the date label is clicked", async () => {
    const user = userEvent.setup();
    renderGallery();

    await user.click(screen.getByText("Mar 15, 2024"));

    // A date input should appear — input[type=date] isn't a "textbox" role;
    // query it by its current value instead.
    expect(screen.getByDisplayValue("2024-03-15")).toBeInTheDocument();
    // Save (✓) and Cancel (✗) buttons appear.
    expect(screen.getByRole("button", { name: /save date/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("calls updatePhoto.mutate with the new date when ✓ is clicked", async () => {
    const user = userEvent.setup();
    renderGallery();

    // Enter edit mode.
    await user.click(screen.getByText("Mar 15, 2024"));

    // Change the date value.
    const dateInput = screen.getByDisplayValue("2024-03-15");
    await user.clear(dateInput);
    await user.type(dateInput, "2024-06-01");

    // Click the save button.
    await user.click(screen.getByRole("button", { name: /save date/i }));

    // updatePhoto.mutate must have been called with the correct arguments.
    expect(mockUpdateMutate).toHaveBeenCalledOnce();
    expect(mockUpdateMutate).toHaveBeenCalledWith(
      { id: "tree-abc", photoId: "photo-1", data: { takenAt: "2024-06-01" } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("exits edit mode and invalidates queries after a successful save", async () => {
    const user = userEvent.setup();
    renderGallery();

    await user.click(screen.getByText("Mar 15, 2024"));

    // Click save without changing the date — still a valid save.
    await user.click(screen.getByRole("button", { name: /save date/i }));

    // onSuccess fired: edit mode should be gone and queries invalidated.
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /save date/i })).toBeNull();
    });
    expect(mockInvalidateQueries).toHaveBeenCalled();
  });

  it("cancels editing without calling mutate when ✗ is clicked", async () => {
    const user = userEvent.setup();
    renderGallery();

    await user.click(screen.getByText("Mar 15, 2024"));
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    // Edit mode exits without any network call.
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /save date/i })).toBeNull();
    });
    expect(mockUpdateMutate).not.toHaveBeenCalled();
  });

  it("does not crash when save is clicked and the mutation succeeds", async () => {
    const user = userEvent.setup();

    // Guard against the original runtime failure: mutate must call onSuccess
    // and the component must not throw.
    expect(() => renderGallery()).not.toThrow();

    await user.click(screen.getByText("Mar 15, 2024"));
    await user.click(screen.getByRole("button", { name: /save date/i }));

    // Mutation ran and the component is still mounted without error.
    expect(mockUpdateMutate).toHaveBeenCalledOnce();
    expect(screen.getByText("Progression")).toBeInTheDocument();
  });

  it("does not call updatePhoto.mutate when the date field is empty", async () => {
    const user = userEvent.setup();
    renderGallery();

    // Enter edit mode.
    await user.click(screen.getByText("Mar 15, 2024"));

    // Clear the date input by firing a change event with an empty value.
    // (userEvent.clear on type="date" inputs is unreliable in JSDOM; fireEvent
    // directly sets the raw value and triggers the onChange handler.)
    const dateInput = screen.getByDisplayValue("2024-03-15");
    fireEvent.change(dateInput, { target: { value: "" } });

    // Click Save with an empty date.
    await user.click(screen.getByRole("button", { name: /save date/i }));

    // saveEdit must bail out early — mutate must never be called.
    expect(mockUpdateMutate).not.toHaveBeenCalled();
  });

  it("stays in edit mode when save is blocked by an empty date", async () => {
    const user = userEvent.setup();
    renderGallery();

    // Enter edit mode.
    await user.click(screen.getByText("Mar 15, 2024"));

    // Clear the date field.
    const dateInput = screen.getByDisplayValue("2024-03-15");
    fireEvent.change(dateInput, { target: { value: "" } });

    // Attempt to save.
    await user.click(screen.getByRole("button", { name: /save date/i }));

    // The component must remain in edit mode so the user can correct the date.
    expect(screen.getByRole("button", { name: /save date/i })).toBeInTheDocument();
  });

  it("shows an inline error message when save is attempted with an empty date", async () => {
    const user = userEvent.setup();
    renderGallery();

    // Enter edit mode.
    await user.click(screen.getByText("Mar 15, 2024"));

    // Clear the date field.
    const dateInput = screen.getByDisplayValue("2024-03-15");
    fireEvent.change(dateInput, { target: { value: "" } });

    // Attempt to save.
    await user.click(screen.getByRole("button", { name: /save date/i }));

    // An inline error message must be visible.
    expect(screen.getByText("Date is required")).toBeInTheDocument();
  });

  it("clears the error message when the user enters a valid date", async () => {
    const user = userEvent.setup();
    renderGallery();

    // Enter edit mode and trigger the error.
    await user.click(screen.getByText("Mar 15, 2024"));
    const dateInput = screen.getByDisplayValue("2024-03-15");
    fireEvent.change(dateInput, { target: { value: "" } });
    await user.click(screen.getByRole("button", { name: /save date/i }));
    expect(screen.getByText("Date is required")).toBeInTheDocument();

    // Now type a valid date — error should clear.
    fireEvent.change(dateInput, { target: { value: "2024-09-01" } });
    expect(screen.queryByText("Date is required")).toBeNull();
  });
});

describe("ProgressionGallery — delete flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: delete mutate calls onSuccess immediately.
    mockDeleteMutate.mockImplementation(
      (_vars: unknown, opts: { onSuccess?: () => void }) => {
        opts?.onSuccess?.();
      },
    );
  });

  it("shows confirmation UI when the trash icon is clicked", async () => {
    const user = userEvent.setup();
    renderGallery();

    // The trash button is present before confirmation.
    const trashBtn = screen.getByRole("button", { name: /delete photo/i });
    await user.click(trashBtn);

    // Confirmation buttons should now be visible.
    expect(screen.getByRole("button", { name: /^delete$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    // The initial trash button should be gone.
    expect(screen.queryByRole("button", { name: /delete photo/i })).toBeNull();
  });

  it("calls deletePhoto.mutate with the correct photoId when Delete is confirmed", async () => {
    const user = userEvent.setup();
    renderGallery();

    await user.click(screen.getByRole("button", { name: /delete photo/i }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(mockDeleteMutate).toHaveBeenCalledOnce();
    expect(mockDeleteMutate).toHaveBeenCalledWith(
      { id: "tree-abc", photoId: "photo-1" },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("does NOT call deletePhoto.mutate and clears confirm state when Cancel is clicked", async () => {
    const user = userEvent.setup();
    renderGallery();

    await user.click(screen.getByRole("button", { name: /delete photo/i }));

    // Confirm state is active — cancel it.
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    // Mutate must never have been called.
    expect(mockDeleteMutate).not.toHaveBeenCalled();

    // Confirm UI is gone; the trash button is back.
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /^delete$/i })).toBeNull();
    });
    expect(screen.getByRole("button", { name: /delete photo/i })).toBeInTheDocument();
  });
});
