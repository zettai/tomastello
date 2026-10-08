"use client";

import { usePathname } from "next/navigation";

export function Footer() {
  const currentYear = new Date().getFullYear();
  const pathname = usePathname();

  // Don't show footer on admin, login, or register pages
  if (pathname?.startsWith("/admin") || pathname === "/login" || pathname === "/register") {
    return null;
  }

  return (
    <footer className="mt-8 py-6 border-t border-border" style={{ backgroundColor: 'var(--background-tertiary)' }}>
      <div className="max-w-4xl mx-auto px-4 text-center">
        <div className="retro-window inline-block min-w-[300px]">
          <div className="retro-title-bar">[ COPYRIGHT.TXT ]</div>
          <div className="p-4">
            <p className="text-sm text-foreground font-mono">
              © {currentYear} Tomás Tello. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
