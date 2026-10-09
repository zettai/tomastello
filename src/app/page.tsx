import type { Metadata } from "next";
import { headers } from "next/headers";
import AboutMarkdown from "@/components/AboutMarkdown";
import LinksSection from "@/components/LinksSection";
import PhotoGalleryClient from "@/components/PhotoGalleryClient";
import SongPlayer from "@/components/SongPlayer";
import { getPublicHomeData } from "@/lib/publicHome";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
/** Scaleway SDK needs Node; Netlify may otherwise run the page on Edge without bucket creds. */
export const runtime = "nodejs";

export async function generateMetadata(): Promise<Metadata> {
  await headers();
  const { contentVersion } = await getPublicHomeData();
  return {
    other: { "content-version": contentVersion },
  };
}

export default async function Home() {
  await headers();
  const { aboutContent, links, photos } = await getPublicHomeData();

  return (
    <div className="min-h-screen p-4 sm:p-8" style={{ backgroundColor: "var(--background-tertiary)" }}>
      <main className="max-w-4xl mx-auto space-y-4">
        <header className="retro-window">
          <div className="retro-title-bar">[ TOMAS_TELLO.EXE ]</div>
          <h1 className="px-4 py-5 text-2xl sm:text-3xl font-medium uppercase tracking-[0.3em] text-foreground">
            Tomás Tello
          </h1>
        </header>

        <div className="retro-window retro-window-featured">
          <div className="retro-title-bar">[ LIVE_RADIO.EXE ]</div>
          <div className="p-4 text-center">
            <a
              href="https://eccosdelfuturo.wordpress.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="retro-button inline-block text-foreground"
            >
              &gt;&gt; ECCOS DEL FUTURO &lt;&lt;
            </a>
            <p lang="es" className="mt-3 mx-auto max-w-[70ch] text-sm leading-relaxed text-foreground-secondary">
              [ todos los días, de 7:30 a 10:00 AM paso música, audiolibros y cualquier cosa. Eccos del Futuro es un
              espacio radial propuesto por Mauricio Banda, co-operador en Andesground ]
            </p>
          </div>
        </div>

        <div className="retro-window">
          <div className="retro-title-bar">[ ABOUT.TXT ]</div>
          <section
            className="retro-inset p-4 m-2 bg-background text-foreground leading-relaxed"
            aria-label="About Tomás Tello"
          >
            <AboutMarkdown content={aboutContent} />
          </section>
        </div>

        <LinksSection links={links} />
        <SongPlayer />
        <PhotoGalleryClient photos={photos} />
      </main>
    </div>
  );
}
