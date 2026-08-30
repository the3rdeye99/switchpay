import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PayButton } from "./PayButton.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PayButton", () => {
  it("renders default label 'Pay now' when no children given", () => {
    render(<PayButton amount={5000} email="customer@example.com" />);
    expect(screen.getByRole("button")).toHaveTextContent("Pay now");
  });

  it("renders custom children as the label", () => {
    render(
      <PayButton amount={5000} email="customer@example.com">
        Pay ₦5,000
      </PayButton>
    );
    expect(screen.getByRole("button")).toHaveTextContent("Pay ₦5,000");
  });

  it("respects an explicit disabled prop", () => {
    render(<PayButton amount={5000} email="customer@example.com" disabled />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("renders as a type=button element to avoid accidental form submission", () => {
    render(<PayButton amount={5000} email="customer@example.com" />);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("forwards a className to the underlying button", () => {
    render(<PayButton amount={5000} email="customer@example.com" className="my-btn" />);
    expect(screen.getByRole("button")).toHaveClass("my-btn");
  });
});
