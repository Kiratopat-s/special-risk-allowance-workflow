// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
const motion = vi.hoisted(() => ({
  reduced: true,
  visible: true,
  animate: vi.fn(),
  inView: vi.fn(),
}));
vi.mock("motion/react", () => ({
  useReducedMotion: () => motion.reduced,
  useInView: motion.inView,
  animate: motion.animate,
}));
import { CountUp } from "@/components/react-bits/count-up";
import { SpotlightCard } from "@/components/react-bits/spotlight-card";

type TweenCallbacks = {
  onUpdate: (value: number) => void;
  onComplete: () => void;
};

const mediaListeners = new Set<() => void>();

function setReducedMotion(reduced: boolean) {
  act(() => {
    motion.reduced = reduced;
    mediaListeners.forEach((listener) => listener());
  });
}

function tweenCallbacks(index = 0) {
  return motion.animate.mock.calls[index][2] as TweenCallbacks;
}

beforeEach(() => {
  motion.reduced = true;
  motion.visible = true;
  motion.inView.mockImplementation(() => motion.visible);
  motion.animate.mockImplementation(() => ({ stop: vi.fn() }));
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      get matches() {
        return motion.reduced;
      },
      addEventListener: (_event: string, listener: () => void) =>
        mediaListeners.add(listener),
      removeEventListener: (_event: string, listener: () => void) =>
        mediaListeners.delete(listener),
    })),
  );
});

afterEach(() => {
  cleanup();
  mediaListeners.clear();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("overview motion accessibility", () => {
  it("renders the final amount for assistive technology and skips animation with reduced motion", () => {
    const { container } = render(<CountUp to={7650} decimals={2} />);
    expect(container.querySelector(".sr-only")?.textContent).toBe("7,650.00");
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe(
      "7,650.00",
    );
    expect(motion.animate).not.toHaveBeenCalled();
  });

  it("renders zero on the server while keeping the final amount accessible", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<CountUp to={7650} decimals={2} />);
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe(
      "0.00",
    );
    expect(container.querySelector(".sr-only")?.textContent).toBe("7,650.00");
  });

  it("waits at zero until entering view and uses the once-only viewport setting", () => {
    motion.reduced = false;
    motion.visible = false;
    const { container, rerender } = render(<CountUp to={42} />);
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe(
      "0",
    );
    expect(motion.animate).not.toHaveBeenCalled();
    expect(motion.inView).toHaveBeenLastCalledWith(expect.anything(), {
      once: true,
    });

    motion.visible = true;
    rerender(<CountUp to={42} />);
    expect(motion.animate).toHaveBeenCalledTimes(1);
    rerender(<CountUp to={42} />);
    expect(motion.animate).toHaveBeenCalledTimes(1);
  });

  it.each([
    { to: 42, decimals: 0, current: 20.6, interim: "21", final: "42" },
    {
      to: 1234567.89,
      decimals: 2,
      current: 456789.126,
      interim: "456,789.13",
      final: "1,234,567.89",
    },
  ])("finishes the $to count with an exact two-second tween", (example) => {
    motion.reduced = false;
    const { container } = render(
      <CountUp to={example.to} decimals={example.decimals} />,
    );
    const visible = container.querySelector('[aria-hidden="true"]');
    expect(visible?.textContent).toBe(example.decimals ? "0.00" : "0");
    expect(motion.animate).toHaveBeenCalledWith(
      0,
      example.to,
      expect.objectContaining({
        type: "tween",
        duration: 2,
        ease: "easeOut",
      }),
    );

    tweenCallbacks().onUpdate(example.current);
    expect(visible?.textContent).toBe(example.interim);
    expect(container.querySelector(".sr-only")?.textContent).toBe(example.final);
    tweenCallbacks().onComplete();
    expect(visible?.textContent).toBe(example.final);
  });

  it("keeps zero totals at zero without starting an animation", () => {
    motion.reduced = false;
    const { container } = render(<CountUp to={0} decimals={2} />);
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe(
      "0.00",
    );
    expect(motion.animate).not.toHaveBeenCalled();
  });

  it("stops the old tween and restarts from zero when the target changes", () => {
    motion.reduced = false;
    const { container, rerender } = render(<CountUp to={100} />);
    const visible = container.querySelector('[aria-hidden="true"]');
    const oldCallbacks = tweenCallbacks();
    oldCallbacks.onUpdate(40);
    rerender(<CountUp to={200} />);

    expect(motion.animate.mock.results[0].value.stop).toHaveBeenCalledOnce();
    expect(motion.animate).toHaveBeenLastCalledWith(
      0,
      200,
      expect.objectContaining({ duration: 2 }),
    );
    expect(visible?.textContent).toBe("0");
    expect(container.querySelector(".sr-only")?.textContent).toBe("200");
    oldCallbacks.onUpdate(90);
    oldCallbacks.onComplete();
    expect(visible?.textContent).toBe("0");
    tweenCallbacks(1).onComplete();
    expect(visible?.textContent).toBe("200");
  });

  it("immediately finishes and stops when reduced motion is enabled mid-animation", () => {
    motion.reduced = false;
    const { container } = render(<CountUp to={7650} decimals={2} />);
    const visible = container.querySelector('[aria-hidden="true"]');
    const callbacks = tweenCallbacks();
    callbacks.onUpdate(1000);
    setReducedMotion(true);

    expect(motion.animate.mock.results[0].value.stop).toHaveBeenCalledOnce();
    expect(motion.animate).toHaveBeenCalledTimes(1);
    expect(visible?.textContent).toBe("7,650.00");
    callbacks.onUpdate(2000);
    expect(visible?.textContent).toBe("7,650.00");
  });

  it("stops animation and removes the media subscription on unmount", () => {
    motion.reduced = false;
    const { container, unmount } = render(<CountUp to={100} />);
    const visible = container.querySelector('[aria-hidden="true"]');
    const callbacks = tweenCallbacks();
    callbacks.onUpdate(40);
    expect(mediaListeners.size).toBe(1);
    unmount();

    expect(motion.animate.mock.results[0].value.stop).toHaveBeenCalledOnce();
    expect(mediaListeners.size).toBe(0);
    callbacks.onUpdate(90);
    callbacks.onComplete();
    expect(visible?.textContent).toBe("40");
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
