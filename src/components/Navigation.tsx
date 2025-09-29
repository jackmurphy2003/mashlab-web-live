import React from "react";

function BrandLockup({ onTabChange }: { onTabChange: (tab: "search" | "library" | "mashups") => void }) {
  return (
    <div
      onClick={() => onTabChange("search")}
      aria-label="MashLab home"
      // font-size drives both logo (via em) and wordmark
      className="flex items-center gap-2 md:gap-3 hover:opacity-95 cursor-pointer
                 text-[28px] md:text-[clamp(32px,4.2vw,48px)] leading-none"
    >
      <img
        src="/brand/mashlab-logo.png"
        alt="MashLab logo"
        /* 1) Slightly taller than the type
           2) Negative right margin lets text sit inside the PNG's transparent edge
           3) Tiny baseline nudge for optical alignment */
        className="h-[1.18em] w-auto object-contain select-none align-middle
                   -mr-1 md:-mr-1.5 translate-y-[0.5px]"
        draggable={false}
      />
      <span className="font-extrabold tracking-tight text-[#E8EDFF] align-middle">
        MashLab
      </span>
    </div>
  );
}

type NavigationProps = {
  activeTab: "search" | "library" | "mashups";
  onTabChange: (tab: "search" | "library" | "mashups") => void;
};

export default function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const nav = [
    { href: "/search", label: "Search" },
    { href: "/library", label: "Library" },
    { href: "/mashups", label: "Mashups" },
  ];
  
  return (
    <div className="flex items-center justify-between mb-6">
      <BrandLockup onTabChange={onTabChange} />
      
      <nav className="flex items-center gap-8 ml-16">
        {nav.map((n) => {
          const tabKey = n.label.toLowerCase() as "search" | "library" | "mashups";
          const active = activeTab === tabKey;
          return (
            <button
              key={n.href}
              onClick={() => {
                console.log('🎯 CLICKING TAB:', tabKey);
                onTabChange(tabKey);
              }}
              className={`relative text-[15px] font-medium ${
                active ? "text-[#E8EDFF]" : "text-[#96A0C2] hover:text-[#E8EDFF]"
              }`}
            >
              {n.label}
              {active && (
                <span className="absolute -bottom-2 left-0 right-0 h-[2px] rounded bg-[#8A7CFF]" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}