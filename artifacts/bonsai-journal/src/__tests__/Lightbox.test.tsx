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
  TransformComponent: ({ children, wrapperStyle, contentStyle }: {
    children: React.ReactNode;
    wrapperStyle: React.CSSProperties;
    contentStyle: React.CSSProperties;
  }) => <div data-testid="zoom-window" style={wrapperStyle}><div data-testid="zoom-content" style={contentStyle}>{children}</div></div>,
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

  function setPhotoBounds(left = 0, width = 1200, top = 0, height = 800) {
    const image = screen.getByRole("img");
    Object.defineProperties(image, {
      naturalWidth: { configurable: true, value: 400 },
      naturalHeight: { configurable: true, value: 800 },
    });
    vi.spyOn(image, "getBoundingClientRect").mockReturnValue({
      left, top, width, height, right: left + width, bottom: top + height,
      x: left, y: top, toJSON: () => ({}),
    });
    return image;
  }

  it("uses a full-screen zoom window and enlarges the contained photo to fit", () => {
    renderLightbox();
    expect(screen.getByTestId("zoom-window").style.width).toBe("100vw");
    expect(screen.getByTestId("zoom-window").style.height).toBe("100dvh");
    expect(screen.getByTestId("zoom-content")).toHaveStyle({
      width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
    });
    const image = screen.getByRole("img");
    expect(image).toHaveStyle({ width: "100%", height: "100%", objectFit: "contain" });
    expect(image.style.maxWidth).toBe("");
    expect(image.style.maxHeight).toBe("");
  });

  it("closes on contain gutters but not on the visible photo or zoom buttons", () => {
    renderLightbox();
    const image = setPhotoBounds();
    fireEvent.click(image, { clientX: 600, clientY: 400 });
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(image, { clientX: 100, clientY: 400 });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("hit-tests the zoomed and panned photo rather than its initial edges", () => {
    renderLightbox();
    const image = setPhotoBounds(-600, 2400, -400, 1600);
    fireEvent.click(image, { clientX: 300, clientY: 400 });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(image, { clientX: 100, clientY: 400 });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not dismiss after dragging into a gutter", () => {
    renderLightbox();
    const image = setPhotoBounds();
    // jsdom does not provide PointerEvent; MouseEvent supplies its coordinates.
    fireEvent(image, new MouseEvent("pointerdown", { bubbles: true, clientX: 600, clientY: 400, buttons: 1 }));
    fireEvent(image, new MouseEvent("pointermove", { bubbles: true, clientX: 100, clientY: 400, buttons: 1 }));
    fireEvent.click(image, { clientX: 100, clientY: 400 });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("saves an edited note before dismissing through a gutter", async () => {
    const user = userEvent.setup();
    renderLightbox();
    const image = setPhotoBounds();
    await user.click(screen.getByRole("button", { name: "Add a note" }));
    await user.type(screen.getByRole("textbox", { name: "Photo note" }), "Before closing");
    fireEvent.click(image, { clientX: 100, clientY: 400 });
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onSaveNote).toHaveBeenCalledWith("Before closing");
  });

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

  it("keeps the original lightbox layout when note controls are omitted", () => {
    render(
      <Lightbox
        src="https://example.com/tree.jpg"
        onClose={onClose}
        onPrev={onPrev}
        onNext={onNext}
        hasPrev={false}
        hasNext={false}
      />,
    );

    expect(screen.queryByRole("region", { name: "Photo note" })).toBeNull();
    expect(screen.getByRole("button", { name: "Zoom in" }).parentElement).toHaveClass("bottom-6");
  });
});