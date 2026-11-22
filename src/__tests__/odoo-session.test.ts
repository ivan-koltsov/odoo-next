import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStoreMock = {
  get: vi.fn(),
  set: vi.fn(),
};

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

const odooGetSessionInfoMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStoreMock),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

vi.mock("@/lib/odoo/client", () => ({
  odooGetSessionInfo: (...args: unknown[]) => odooGetSessionInfoMock(...args),
}));

import {
  clearSessionCookie,
  getCurrentSession,
  getSessionId,
  requireSession,
  setSessionCookie,
} from "@/lib/odoo/session";

const MOCK_USER = {
  uid: 2,
  name: "Mitchell Admin",
  username: "admin",
  db: "odoo",
  partnerId: 3,
  companyId: 1,
  serverVersion: "18.0",
  isAdmin: true,
  isSystem: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("odoo session helpers", () => {
  it("reads session cookie via getSessionId", async () => {
    cookieStoreMock.get.mockReturnValueOnce({ value: "sid_123" });
    await expect(getSessionId()).resolves.toBe("sid_123");

    cookieStoreMock.get.mockReturnValueOnce(undefined);
    await expect(getSessionId()).resolves.toBeNull();
  });

  it("sets HttpOnly SameSite=lax cookie on setSessionCookie", async () => {
    await setSessionCookie("sid_abc");

    expect(cookieStoreMock.set).toHaveBeenCalledWith(
      "odoo_session_id",
      "sid_abc",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      })
    );
  });

  it("clears session cookie with maxAge 0", async () => {
    await clearSessionCookie();

    expect(cookieStoreMock.set).toHaveBeenCalledWith(
      "odoo_session_id",
      "",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      })
    );
  });

  it("returns null from getCurrentSession when cookie is absent or invalid or Odoo throws", async () => {
    cookieStoreMock.get.mockReturnValueOnce(undefined);
    await expect(getCurrentSession()).resolves.toBeNull();
    expect(odooGetSessionInfoMock).not.toHaveBeenCalled();

    cookieStoreMock.get.mockReturnValueOnce({ value: "expired_sid" });
    odooGetSessionInfoMock.mockResolvedValueOnce(null);
    await expect(getCurrentSession()).resolves.toBeNull();

    cookieStoreMock.get.mockReturnValueOnce({ value: "sid_err" });
    odooGetSessionInfoMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(getCurrentSession()).resolves.toBeNull();
  });

  it("returns active session from getCurrentSession and requireSession", async () => {
    cookieStoreMock.get.mockReturnValue({ value: "sid_valid" });
    odooGetSessionInfoMock.mockResolvedValue(MOCK_USER);

    await expect(getCurrentSession()).resolves.toEqual({
      sessionId: "sid_valid",
      user: MOCK_USER,
    });

    await expect(requireSession()).resolves.toEqual({
      sessionId: "sid_valid",
      user: MOCK_USER,
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects to /login from requireSession when unauthenticated", async () => {
    cookieStoreMock.get.mockReturnValueOnce(undefined);

    await expect(requireSession()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});
