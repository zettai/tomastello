import type { PublicLink } from "@/lib/publicView";

export default function LinksSection({ links }: { links: PublicLink[] }) {
  if (links.length === 0) return null;
  return (
    <div className="retro-window">
      <div className="retro-title-bar">[ LINKS.TXT ]</div>
      <div className="p-4">
        <ul className="space-y-2">
          {links.map((link) => (
            <li key={link.id}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="retro-button inline-block text-foreground hover:bg-background-secondary px-4 py-2"
              >
                &gt; {link.text}
              </a>
              {link.description && (
                <p className="text-sm leading-relaxed text-foreground-secondary mt-1 ml-4">{link.description}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
