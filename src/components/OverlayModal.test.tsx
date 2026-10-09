import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConfirmDeleteModal, OverlayModal } from "./OverlayModal";

describe("OverlayModal", () => {
  it("should close when Escape is pressed", async () => {
    const onClose = jest.fn();
    render(
      <OverlayModal open title="Test dialog" onClose={onClose}>
        <p>Body</p>
      </OverlayModal>
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("should render title as text only with no HTML", async () => {
    render(
      <OverlayModal
        open
        title="<img src=x onerror=alert(1)>"
        onClose={() => undefined}
      >
        <p>Body</p>
      </OverlayModal>
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(document.querySelector(".overlay-modal-panel img")).toBeNull();
  });
});

describe("ConfirmDeleteModal", () => {
  it("should focus Cancel first, not Delete", async () => {
    render(
      <ConfirmDeleteModal
        open
        itemName="Song A"
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    });
    expect(screen.getByRole("button", { name: "Delete" })).not.toHaveFocus();
  });

  it("should show item name as text in the title", async () => {
    render(
      <ConfirmDeleteModal
        open
        itemName="<b>evil</b>"
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Delete <b>evil</b>?")).toBeInTheDocument();
    });
    expect(document.querySelector(".overlay-modal-panel b")).toBeNull();
  });

  it("should call onCancel when Cancel is clicked", async () => {
    const onCancel = jest.fn();
    render(
      <ConfirmDeleteModal
        open
        itemName="file.png"
        onCancel={onCancel}
        onConfirm={() => undefined}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("should call onConfirm when Delete is clicked", async () => {
    const onConfirm = jest.fn();
    render(
      <ConfirmDeleteModal
        open
        itemName="file.png"
        onCancel={() => undefined}
        onConfirm={onConfirm}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
