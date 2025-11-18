import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ImpactDisplay } from "./ImpactDisplay";

// Make animations synchronous in tests by mocking useCountUp to return the target immediately
vi.mock("../hooks/useImpactCalculations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hooks/useImpactCalculations")>();
  return {
    ...actual,
    useCountUp: (target: number) => target,
  };
});

describe("ImpactDisplay", () => {
  it("renders null message when cumulativeCharity is null", () => {
    render(<ImpactDisplay cumulativeCharity={null} />);
    expect(screen.getByText("No impact data available.")).toBeInTheDocument();
    expect(screen.queryByText("Meals")).not.toBeInTheDocument();
  });

  it("renders null message when cumulativeCharity is 0", () => {
    render(<ImpactDisplay cumulativeCharity={0} />);
    expect(screen.getByText("No impact data available.")).toBeInTheDocument();
    expect(screen.queryByText("Meals")).not.toBeInTheDocument();
  });

  it("calculates and displays correct metrics for $100 charity", () => {
    render(<ImpactDisplay cumulativeCharity={100} />);

    expect(screen.getByText("1,000 Meals")).toBeInTheDocument();
    expect(screen.getByText(/1,200 lbs rescued/i)).toBeInTheDocument();
    expect(screen.getByText("100 Person-Years")).toBeInTheDocument();
    expect(screen.getByText(/110,000 liters provided/i)).toBeInTheDocument();
  });

  it("calculates and displays correct metrics for large charity amount", () => {
    render(<ImpactDisplay cumulativeCharity={86735} />);

    expect(screen.getByText("867,350 Meals")).toBeInTheDocument();
    expect(screen.getByText(/1,040,820 lbs rescued/i)).toBeInTheDocument();
    expect(screen.getByText("86,735 Person-Years")).toBeInTheDocument();
    expect(screen.getByText(/95,408,500 liters provided/i)).toBeInTheDocument();
  });

  it("overrides default metrics with custom configs", () => {
    render(
      <ImpactDisplay
        cumulativeCharity={100}
        foodConfig={{ mealsPerDollar: 5, lbsPerDollar: 2 }}
        waterConfig={{ personYearsPerDollar: 10, litersPerDollar: 500 }}
      />
    );

    expect(screen.getByText("500 Meals")).toBeInTheDocument();
    expect(screen.getByText(/200 lbs rescued/i)).toBeInTheDocument();
    expect(screen.getByText("1,000 Person-Years")).toBeInTheDocument();
    expect(screen.getByText(/50,000 liters provided/i)).toBeInTheDocument();
  });

  it("displays correct aria-label", () => {
    render(<ImpactDisplay cumulativeCharity={1000} />);

    const container = screen.getByLabelText("Cumulative impact from $1,000");
    expect(container).toBeInTheDocument();
  });

  it("applies correct CSS classes for responsive layout", () => {
    render(<ImpactDisplay cumulativeCharity={100} />);

    const container = screen.getByLabelText("Cumulative impact from $100");
    expect(container).toHaveClass(
      "grid",
      "grid-cols-1",
      "gap-4",
      "text-sm",
      "text-slate-300",
      "sm:grid-cols-2"
    );
  });

  it("renders food and water icons", () => {
    render(<ImpactDisplay cumulativeCharity={100} />);

    // Check for the presence of SVG icons (they have specific classes)
    const foodIcon = document.querySelector(".text-amber-400");
    const waterIcon = document.querySelector(".text-sky-400");

    expect(foodIcon).toBeInTheDocument();
    expect(waterIcon).toBeInTheDocument();
  });

  it("renders correct card titles and descriptions", () => {
    render(<ImpactDisplay cumulativeCharity={100} />);

    expect(screen.getByText("Team Food Impact")).toBeInTheDocument();
    expect(
      screen.getByText("Provided to families in need (via Feeding America)")
    ).toBeInTheDocument();

    expect(screen.getByText("Team Water Impact")).toBeInTheDocument();
    expect(
      screen.getByText("Of clean water access (via WaterAid)")
    ).toBeInTheDocument();
  });

  it("matches snapshot", () => {
    const { container } = render(<ImpactDisplay cumulativeCharity={86735} />);
    expect(container).toMatchSnapshot();
  });

  it("handles charity amount changes gracefully", () => {
    const { rerender } = render(<ImpactDisplay cumulativeCharity={100} />);

    // Initial render should show metrics for $100
    expect(screen.getByText("1,000 Meals")).toBeInTheDocument();

    // Re-render with higher amount ($200)
    rerender(<ImpactDisplay cumulativeCharity={200} />);

    // Should show metrics for $200
    expect(screen.getByText("2,000 Meals")).toBeInTheDocument();
    expect(screen.getByText(/2,400 lbs rescued/i)).toBeInTheDocument();
    expect(screen.getByText("200 Person-Years")).toBeInTheDocument();
    expect(screen.getByText(/220,000 liters provided/i)).toBeInTheDocument();
  });

  it("shows no impact data when charity becomes 0", () => {
    const { rerender } = render(<ImpactDisplay cumulativeCharity={100} />);

    // Initial render should show metrics for $100
    expect(screen.getByText("1,000 Meals")).toBeInTheDocument();

    // Re-render with 0 charity
    rerender(<ImpactDisplay cumulativeCharity={0} />);

    // Should show no impact data message
    expect(screen.getByText("No impact data available.")).toBeInTheDocument();
    expect(screen.queryByText("Meals")).not.toBeInTheDocument();
  });
});
