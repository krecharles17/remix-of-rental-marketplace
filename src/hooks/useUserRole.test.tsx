import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const authState = { user: null as { id: string } | null, loading: true };
const rolesResult = { data: [] as { role: string }[], error: null as unknown };
const insertMock = vi.fn(async (_row: unknown) => ({ error: null }));
const selectSpy = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: (cols: string) => {
        selectSpy(table, cols);
        return { eq: async () => rolesResult };
      },
      insert: (row: unknown) => insertMock(row),
    }),
  },
}));

vi.mock("./useAuth", () => ({ useAuth: () => authState }));

import { useUserRole } from "./useUserRole";

beforeEach(() => {
  authState.user = null;
  authState.loading = true;
  rolesResult.data = [];
  rolesResult.error = null;
  insertMock.mockClear();
  selectSpy.mockClear();
});

describe("useUserRole", () => {
  it("stays loading while auth is loading", () => {
    const { result } = renderHook(() => useUserRole());
    expect(result.current.loading).toBe(true);
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it("returns no roles for a signed-out visitor", async () => {
    authState.loading = false;
    const { result } = renderHook(() => useUserRole());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.roles).toEqual([]);
    expect(result.current.isHost).toBe(false);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isGuest).toBe(false);
  });

  it("loads roles for a signed-in guest", async () => {
    authState.loading = false;
    authState.user = { id: "u1" };
    rolesResult.data = [{ role: "guest" }];
    const { result } = renderHook(() => useUserRole());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.roles).toEqual(["guest"]);
    expect(result.current.isGuest).toBe(true);
    expect(result.current.isHost).toBe(false);
    expect(selectSpy).toHaveBeenCalledWith("user_roles", "role");
  });

  it("treats an admin as a host too", async () => {
    authState.loading = false;
    authState.user = { id: "u1" };
    rolesResult.data = [{ role: "admin" }];
    const { result } = renderHook(() => useUserRole());
    await waitFor(() => expect(result.current.isAdmin).toBe(true));
    expect(result.current.isHost).toBe(true);
    expect(result.current.hasRole("admin")).toBe(true);
    expect(result.current.hasRole("guest")).toBe(false);
  });

  it("keeps empty roles when the lookup fails", async () => {
    authState.loading = false;
    authState.user = { id: "u1" };
    rolesResult.data = [{ role: "host" }];
    rolesResult.error = { message: "denied" };
    const { result } = renderHook(() => useUserRole());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.roles).toEqual([]);
  });

  it("adds the host role locally after a successful request", async () => {
    authState.loading = false;
    authState.user = { id: "u1" };
    rolesResult.data = [{ role: "guest" }];
    const { result } = renderHook(() => useUserRole());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.requestHostRole();
    });
    expect(insertMock).toHaveBeenCalledWith({ user_id: "u1", role: "host" });
    await waitFor(() => expect(result.current.isHost).toBe(true));
  });

  it("does not request the host role again for an existing host", async () => {
    authState.loading = false;
    authState.user = { id: "u1" };
    rolesResult.data = [{ role: "host" }];
    const { result } = renderHook(() => useUserRole());
    await waitFor(() => expect(result.current.isHost).toBe(true));
    await act(async () => {
      await result.current.requestHostRole();
    });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("refuses the host request when signed out", async () => {
    authState.loading = false;
    const { result } = renderHook(() => useUserRole());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(result.current.requestHostRole()).resolves.toEqual({ error: "Not authenticated" });
    expect(insertMock).not.toHaveBeenCalled();
  });
});
