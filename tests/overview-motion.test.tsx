// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
const motion = vi.hoisted(() => ({ reduced: true, set: vi.fn(), on: vi.fn() }));
vi.mock("motion/react", () => ({
  useReducedMotion: () => motion.reduced,
  useInView: () => true,
  useMotionValue: () => ({ set: motion.set }),
  useSpring: () => ({ on: motion.on }),
}));
import { CountUp } from "@/components/react-bits/count-up";
import { SpotlightCard } from "@/components/react-bits/spotlight-card";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("overview motion accessibility", () => {
  it("renders the final amount for assistive technology and skips animation with reduced motion", () => {
    const { container } = render(<CountUp to={7650} decimals={2} />);
    expect(container.querySelector(".sr-only")?.textContent).toBe("7,650.00");
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe(
      "7,650.00",
    );
    expect(motion.set).not.toHaveBeenCalled();
    expect(motion.on).not.toHaveBeenCalled();
  });
  it("does not track pointer animation with reduced motion", () => {
    render(
      <SpotlightCard>
        <span>Requested amount</span>
      </SpotlightCard>,
    );
    const card = screen.getByText("Requested amount").parentElement!;
    fireEvent.mouseMove(card, { clientX: 25, clientY: 45 });
    expect(card.style.getPropertyValue("--mouse-x")).toBe("");
  });
});
