import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import UserListPanel from "../src/components/UserListPanel";
import { clientState } from "@/lib/client/client";

beforeEach(() => {
  clientState.users = [];
  clientState.username = "";
});

describe("UserListPanel", () => {
  it("renders connected users without a WebSocket server", () => {
    clientState.users = [
      { id: "1", username: "Alice" },
      { id: "2", username: "Bob" },
    ];
    clientState.username = "Alice";

    render(<UserListPanel />);

    expect(screen.getByText("Connected Users (2)")).toBeInTheDocument();
    expect(screen.getByText("Alice (you)")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });
});
