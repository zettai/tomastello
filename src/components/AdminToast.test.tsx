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

  describe("auto-dismiss durations", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should dismiss plain success after about 4s", () => {
      render(
        <AdminToastProvider>
          <Trigger />
        </AdminToastProvider>
      );
      act(() => {
        screen.getByText("ok").click();
      });
      expect(screen.getByRole("status")).toHaveTextContent("Saved OK");
      act(() => {
        jest.advanceTimersByTime(3999);
      });
      expect(screen.getByRole("status")).toHaveTextContent("Saved OK");
      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("should keep Undo success for about 10s", () => {
      render(
        <AdminToastProvider>
          <Trigger />
        </AdminToastProvider>
      );
      act(() => {
        screen.getByText("with-undo").click();
      });
      expect(screen.getByRole("status")).toHaveTextContent("Hidden");
      act(() => {
        jest.advanceTimersByTime(9999);
      });
      expect(screen.getByRole("status")).toHaveTextContent("Hidden");
      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("should dismiss errors after about 10s", () => {
      render(
        <AdminToastProvider>
          <Trigger />
        </AdminToastProvider>
      );
      act(() => {
        screen.getByText("err").click();
      });
      expect(screen.getByRole("alert")).toHaveTextContent("Boom");
      act(() => {
        jest.advanceTimersByTime(9999);
      });
      expect(screen.getByRole("alert")).toHaveTextContent("Boom");
      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("should pause dismiss while hovered", () => {
      render(
        <AdminToastProvider>
          <Trigger />
        </AdminToastProvider>
      );
      act(() => {
        screen.getByText("ok").click();
      });
      const toast = screen.getByRole("status");
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      fireEvent.mouseEnter(toast);
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      expect(screen.getByRole("status")).toHaveTextContent("Saved OK");
      fireEvent.mouseLeave(toast);
      act(() => {
        jest.advanceTimersByTime(1999);
      });
      expect(screen.getByRole("status")).toHaveTextContent("Saved OK");
      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });
});
