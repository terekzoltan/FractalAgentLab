import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "./App";

describe("U5-A workbench shell", () => {
  it("renders the evidence observatory shell and navigation labels", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /local evidence observatory shell/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /runs/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /trace/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /packets \/ launch/i })).toBeInTheDocument();
  });

  it("shows fixture disclosure wherever demo evidence appears", () => {
    render(<App />);

    expect(screen.getByText(/fixture-backed shell, not artifact browsing/i)).toBeInTheDocument();
    expect(screen.getAllByText(/synthetic u5-a fixture/i)).toHaveLength(3);
    expect(screen.getAllByText(/fixture\/demo data/i).length).toBeGreaterThan(0);
  });

  it("does not claim real run browsing or trace timelines are implemented", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /runs/i }));
    expect(screen.getByText(/no real run list or run detail page is implemented here/i)).toBeInTheDocument();
    expect(screen.getByText(/u5-b will define the artifact-backed browse model/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /trace/i }));
    expect(screen.getByText(/no real trace timeline is implemented here/i)).toBeInTheDocument();
    expect(screen.getByText(/u5-c will preserve strict trace truth/i)).toBeInTheDocument();
  });

  it("states launch and OpenCode automation are inactive", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /packets \/ launch/i }));

    expect(screen.getByText(/not active/i)).toBeInTheDocument();
    expect(screen.getByText(/no workflow launch/i)).toBeInTheDocument();
    expect(screen.getByText(/opencode automation/i)).toBeInTheDocument();
    expect(screen.queryByText(/provider leaderboard/i)).not.toBeInTheDocument();
  });

  it("keeps evidence and memory pages bounded to later Wave 5 work", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /evidence/i }));
    expect(screen.getByText(/track e must define comparison semantics/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /memory \/ eval/i }));
    expect(screen.getByText(/no memory inspection or editing is implemented here/i)).toBeInTheDocument();
  });
});
