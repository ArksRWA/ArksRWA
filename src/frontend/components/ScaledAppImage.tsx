import { useEffect, useRef, useState } from "react";

function ScaledAppImage() {
  const [isScaledDown, setIsScaledDown] = useState(false);
  const ticking = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        setIsScaledDown(window.scrollY >= 150);
        ticking.current = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const leftBasis = isScaledDown ? "40%" : "0%";
  const rightBasis = isScaledDown ? "60%" : "100%";

  const d = (ms: number) => (isScaledDown ? `${ms}ms` : "0ms");

  return (
    <div
      id="my-element"
      className={`origin-top will-change-transform transition-transform duration-500 ease-out
                  motion-reduce:transition-none motion-reduce:transform-none 
                  ${isScaledDown ? "scale-90 mt-0" : "scale-100 mt-[-15vh] md:mt-32"}`}
    >
      <div className="flex flex-col md:flex-row gap-8 items-stretch">
        {/* LEFT: smoother, staggered reveal (no overflow clipping) */}
        <section
          className={`md:min-w-0 px-2 md:px-0
                      transition-[flex-basis,opacity,transform] duration-500 ease-out
                      motion-reduce:transition-none order-1 md:order-0
                      ${isScaledDown ? "pointer-events-auto" : "pointer-events-none"}`}
          style={{
            flexBasis: leftBasis,
            opacity: isScaledDown ? 1 : 0,
            transform: isScaledDown ? "translateY(0)" : "translateY(6px)",
          }}
          aria-hidden={!isScaledDown}
        >
          <div className="space-y-4">
            <h2
              className={`text-2xl font-semibold text-white
                          will-change-transform will-change-filter
                          transition-all duration-500 ease-out
                          ${isScaledDown ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-1 blur-[2px]"}
                          motion-reduce:transition-none motion-reduce:blur-0`}
              style={{ transitionDelay: d(100) }}
            >
              Explore ARKS RWA
            </h2>

            <p
              className={`text-gray-300 leading-relaxed
                          will-change-transform will-change-filter
                          transition-all duration-500 ease-out
                          ${isScaledDown ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-1 blur-[2px]"}
                          motion-reduce:transition-none motion-reduce:blur-0`}
              style={{ transitionDelay: d(180) }}
            >
              A secure gateway to real-world assets on-chain. Fast, transparent,
              and designed for company and investors.
            </p>

            <ul
              className={`list-disc list-inside text-gray-300 space-y-1
                          will-change-transform will-change-filter
                          transition-all duration-500 ease-out
                          ${isScaledDown ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-1 blur-[2px]"}
                          motion-reduce:transition-none motion-reduce:blur-0`}
              style={{ transitionDelay: d(260) }}
            >
              <li>Onboard assets in minutes</li>
              <li>Compliance-ready primitives</li>
              <li>Granular permissions &amp; audit trails</li>
            </ul>

            <div
              className={`flex gap-3 pt-2
                          will-change-transform will-change-filter
                          transition-all duration-500 ease-out
                          ${isScaledDown ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-1 blur-[2px]"}
                          motion-reduce:transition-none motion-reduce:blur-0`}
              style={{ transitionDelay: d(340) }}
            >
              <a
                href="#"
                className="group relative px-6 py-4 bg-gradient-to-r from-green-600 to-green-700
                           hover:from-green-500 hover:to-green-600 text-white rounded-xl
                           transform-gpu hover:scale-105 transition-all duration-300 disabled:opacity-50 font-bold shadow-2xl"
              >
                Get started
              </a>
            </div>
          </div>
        </section>

        {/* RIGHT: window chrome + screenshot */}
        <div
          className="md:min-w-0 transition-[flex-basis] duration-500 ease-out motion-reduce:transition-none order-0 md:order-1 mt-50 md:mt-0"
          style={{ flexBasis: rightBasis }}
        >
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-800 border-b border-gray-700 rounded-t-3xl">
            <div className="flex gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full" />
              <div className="w-3 h-3 bg-yellow-500 rounded-full" />
              <div className="w-3 h-3 bg-green-500 rounded-full" />
            </div>
            <div className="flex-1 bg-gray-700 rounded-lg px-3 py-1">
              <span className="text-gray-400 text-xs font-mono select-none">
                https://arks.rwa
              </span>
            </div>
          </div>

          <div className="relative">
            <img
              src="/screenshot-web.jpeg"
              alt="ARKS RWA Homepage Screenshot"
              className="w-full h-auto object-cover rounded-b-2xl"
              style={{ maxHeight: "600px" }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none rounded-b-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScaledAppImage;
