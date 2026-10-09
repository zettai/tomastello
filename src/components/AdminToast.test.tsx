import { render, screen, act, waitFor } from "@testing-library/react";
import { AdminToastProvider, useAdminToast } from "./AdminToast";

function Trigger() {
  const { showSuccess, showError } = useAdminToast();
  return (
    <>
      <button type="button" onClick={() => showSuccess("Saved OK")}>
        ok
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
    // Portal mounts after useEffect; wait for the portaled toast.
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
});
