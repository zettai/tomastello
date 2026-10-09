import { render, screen, act, waitFor, fireEvent } from "@testing-library/react";
import { AdminToastProvider, useAdminToast } from "./AdminToast";

function Trigger() {
  const { showSuccess, showError } = useAdminToast();
  return (
    <>
      <button type="button" onClick={() => showSuccess("Saved OK")}>
        ok
      </button>
      <button
        type="button"
        onClick={() =>
          showSuccess("Hidden", {
            onUndo: () => showSuccess("Restored"),
          })
        }
      >
        with-undo
      </button>
      <button type="button" onClick={() => showError("Boom")}>
        err
      </button>
    </>
  );
}

describe("AdminToast", () => {
  it("should render success with role=status", async () => {
    render(
      <AdminToastProvider>
        <Trigger />
      </AdminToastProvider>
    );
    act(() => {
      screen.getByText("ok").click();
    });
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Saved OK");
    });
  });

  it("should render error with role=alert", async () => {
    render(
      <AdminToastProvider>
        <Trigger />
      </AdminToastProvider>
    );
    act(() => {
      screen.getByText("err").click();
    });
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Boom");
    });
  });

  it("should run onUndo when Undo is clicked", async () => {
    render(
      <AdminToastProvider>
        <Trigger />
      </AdminToastProvider>
    );
    act(() => {
      screen.getByText("with-undo").click();
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Restored");
    });
  });

  it("should keep at most two toasts with the newest on top", async () => {
    render(
      <AdminToastProvider>
        <Trigger />
      </AdminToastProvider>
    );
    act(() => {
      screen.getByText("ok").click();
      screen.getByText("err").click();
      screen.getByText("with-undo").click();
    });
    await waitFor(() => {
      const statuses = screen.queryAllByRole("status");
      const alerts = screen.queryAllByRole("alert");
      expect(statuses.length + alerts.length).toBe(2);
      expect(statuses[0]).toHaveTextContent("Hidden");
    });
  });
});
