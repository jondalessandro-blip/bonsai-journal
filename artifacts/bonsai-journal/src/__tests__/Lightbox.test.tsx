import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-zoom-pan-pinch", () => ({
  TransformWrapper: ({
    children,
  }: {
    children: (controls: { zoomIn: () => void; zoomOut: () => void }) => React.ReactNode;
  }) =>
    children({
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
    }),
  TransformComponent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { Lightbox } from "@/components/Lightbox";

describe("Lightbox photo notes", () => {
  const onClose = vi.fn();
  const onPrev = vi.fn();
  const onNext = vi.fn();
  const onSaveNote = vi.fn<(_: string) => Promise<void>>().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    onSaveNote.mockResolvedValue(undefined);
  });

  function renderLightbox(note: string | null = null) {
    return render(
      <Lightbox
        src="https://example.com/tree.jpg"
        alt="A bonsai"
        onClose={onClose}
        onPrev={onPrev}
        onNext={onNext}
        hasPrev
        hasNext
        note={note}
        onSaveNote={onSaveNote}
      />,
    );
  }

  it("lets textarea arrow keys edit text and Escape cancel without closing", async () => {
    const user = userEvent.setup();
    renderLightbox();

    await user.click(screen.getByRole("button", { name: "Add a note" }));
    const textarea = screen.getByRole("textbox", { name: "Photo note" });
    await user.type(textarea, "bonsai");
    await user.keyboard("{ArrowLeft}x");

    expect(textarea).toHaveValue("bonsaxi");
    expect(onPrev).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    expect(onSaveNote).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Add a note" })).toBeInTheDocument();
  });

  it("saves a changed note before moving to another photo", async () => {
    const user = userEvent.setup();
    let releaseSave!: () => void;
    onSaveNote.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseSave = resolve;
        }),
    );
    renderLightbox();

    await user.click(screen.getByRole("button", { name: "Add a note" }));
    await user.type(screen.getByRole("textbox", { name: "Photo note" }), "Spring growth");
    await user.click(screen.getByRole("button", { name: "Next photo" }));

    await waitFor(() => expect(onSaveNote).toHaveBeenCalledWith("Spring growth"));
    expect(onNext).not.toHaveBeenCalled();
    releaseSave();
    await waitFor(() => expect(onNext).toHaveBeenCalledOnce());
  });

  it("keeps the draft and reports an error when the save fails", async () => {
    const user = userEvent.setup();
    onSaveNote.mockRejectedValue(new Error("Network failure"));
    renderLightbox();

    await user.click(screen.getByRole("button", { name: "Add a note" }));
    const textarea = screen.getByRole("textbox", { name: "Photo note" });
    await user.type(textarea, "Keep this draft");
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your text is still here",
    );
    expect(screen.getByRole("textbox", { name: "Photo note" })).toHaveValue(
      "Keep this draft",
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("clears a note when saving a blank draft and enforces the character limit", async () => {
    const user = userEvent.setup();
    renderLightbox("Old note");

    await user.click(screen.getByRole("button", { name: "Edit note" }));
    const textarea = screen.getByRole("textbox", { name: "Photo note" });
    expect(textarea).toHaveAttribute("maxLength", "500");
    fireEvent.change(textarea, { target: { value: " ".repeat(500) } });
    expect(screen.getByText("500/500")).toBeInTheDocument();
    fireEvent.change(textarea, { target: { value: "" } });
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSaveNote).toHaveBeenCalledWith(""));
  });

  it("does not close when the note panel is clicked", async () => {
    const user = userEvent.setup();
    renderLightbox();

    await user.click(screen.getByRole("button", { name: "Add a note" }));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByText("Add a note").closest("section")!);
    expect(onClose).not.toHaveBeenCalled();
  });
});