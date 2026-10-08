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
        <div className="retro-window">
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
            <p className="mt-3 text-xs text-foreground-secondary">
              [ todos los días, de 7:30 a 10:00 AM paso música, audiolibros y cualquier cosa. Eccos del Futuro es un
              espacio radial propuesto por Mauricio Banda, co-operador en Andesground ]
            </p>
          </div>
        </div>

        <div className="retro-window">
          <div className="retro-title-bar">[ ABOUT.TXT ]</div>
          <section
            className="retro-inset p-4 m-2 bg-background text-foreground overflow-auto max-h-96 focus:outline focus:outline-2 focus:outline-offset-2"
            tabIndex={0}
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
