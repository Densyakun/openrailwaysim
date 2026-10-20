import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginScreen from "../src/components/LoginScreen";
import { clientState, SERVER_URL_STORAGE_KEY } from "@/lib/client/client";

beforeEach(() => {
  localStorage.clear();

  clientState.loginOpen = true;
  clientState.loginStatus = "idle";
  clientState.loginError = "";
  clientState.serverUrl = "";
  clientState.localMode = false;
  clientState.isStarted = false;
  clientState.connectionAttempt = 0;
  clientState.username = "";
  clientState.connectionPassword = "";
});

describe("LoginScreen", () => {
  it("shows the login form on startup", () => {
    render(<LoginScreen />);

    expect(screen.getByText("Open Railway Sim")).toBeInTheDocument();
    expect(screen.getByLabelText("Server URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ローカルモードで開始" })).toBeInTheDocument();
  });

  it("starts in local mode from the default page", async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);

    await user.click(screen.getByRole("button", { name: "ローカルモードで開始" }));

    expect(clientState.localMode).toBe(true);
    expect(clientState.isStarted).toBe(true);
    expect(clientState.loginOpen).toBe(false);
    expect(clientState.loginStatus).toBe("connected");
  });

  it("stores the server URL and starts connecting", async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);

    const serverUrl = screen.getByLabelText("Server URL");
    await user.clear(serverUrl);
    await user.type(serverUrl, "ws://example.com:9000/ws");
    await user.type(screen.getByLabelText("Username"), "Tester");
    await user.type(screen.getByLabelText("Password"), "secret");

    await user.click(screen.getByRole("button", { name: "サーバーに接続" }));

    expect(clientState.serverUrl).toBe("ws://example.com:9000/ws");
    expect(clientState.username).toBe("Tester");
    expect(clientState.connectionPassword).toBe("secret");
    expect(clientState.localMode).toBe(false);
    expect(clientState.isStarted).toBe(true);
    expect(clientState.loginOpen).toBe(true);
    expect(clientState.loginStatus).toBe("connecting");
    expect(localStorage.getItem(SERVER_URL_STORAGE_KEY)).toBe("ws://example.com:9000/ws");
  });

  it("rejects non-WebSocket URLs", async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);

    const serverUrl = screen.getByLabelText("Server URL");
    await user.clear(serverUrl);
    await user.type(serverUrl, "http://example.com");
    await user.click(screen.getByRole("button", { name: "サーバーに接続" }));

    expect(clientState.isStarted).toBe(false);
    expect(clientState.loginStatus).toBe("failed");
    expect(clientState.loginError).toContain("WebSocket");
  });
});
