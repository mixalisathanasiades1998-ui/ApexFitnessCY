import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Chrome } from "@/components/site/Chrome";
import { ResumeHome } from "@/components/app/ResumeHome";
import { Footer } from "@/components/site/Footer";
import { Header, type HeaderUser } from "@/components/site/Header";
import {
  DEFAULT_LOCALE,
  dictionaries,
  LOCALE_COOKIE,
  type Locale,
} from "@/i18n/dictionaries";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { currentUser } from "@/lib/auth";
import { hasAvatar } from "@/lib/avatars";
import { getAvailableCredits } from "@/lib/credits";
import "./globals.css";
import { unreadCount } from "@/lib/notices";

export const metadata: Metadata = {
  title: {
    default: "APEX pilates | Reformer Pilates by APEX Fitness Centre",
    template: "%s · APEX pilates",
  },
  description: dictionaries.en.meta.description,
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  /**
   * The manifest, and the icons iOS wants.
   *
   * `manifest` is what turns Add to Home Screen into an installed web app
   * rather than a bookmark, which is what web push requires on iPhone. See
   * app/manifest.ts — that omission is why notifications silently did nothing
   * there for a while.
   *
   * The Apple icon is its own file at 180 and flattened onto the cream, because
   * iOS does not composite transparency: a PNG with an alpha channel gets a
   * black background on the Home Screen.
   */
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/brand/logo-512.png",
    apple: "/brand/apple-touch-icon.png",
  },
  /**
   * The legacy pair of Apple meta tags, still read by iOS and still worth
   * setting alongside the manifest: `capable` is what removes the browser bar,
   * and the title is what appears under the icon instead of the page title,
   * which would otherwise be the whole "APEX pilates | Reformer Pilates by
   * APEX Fitness Centre" line truncated to nothing useful.
   */
  appleWebApp: {
    capable: true,
    title: "APEX pilates",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "APEX pilates | Reformer Pilates by APEX Fitness Centre",
    description: dictionaries.en.meta.description,
    type: "website",
    images: ["/brand/logo-square.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#5B4645",
};

async function readLocale(): Promise<Locale> {
  const jar = await cookies();
  const v = jar.get(LOCALE_COOKIE)?.value;
  return v === "el" ? "el" : DEFAULT_LOCALE;
}

/**
 * There is deliberately no cookie banner here, and that is a decision rather
 * than an omission.
 *
 * This site sets no advertising, analytics or tracking cookie of any kind. What
 * it stores is the sign-in cookie, the desk's own lock, and the language the
 * visitor picked. The first two are strictly necessary, which is exempt from
 * consent; the third is only ever written the moment somebody clicks EN or EL,
 * which is the visitor asking for it, and interface preferences a visitor sets
 * themselves are exempt on the same footing (Article 29 Working Party opinion
 * 04/2012, the "UI customisation" case).
 *
 * So there is nothing here to ask permission for in advance. Not clicking the
 * language switch is the refusal. What is still owed is the telling, and that
 * is /cookies, linked in the footer under Legal, which names every cookie, what
 * it holds and how long it lasts.
 *
 * The one thing that could change this is Stripe: its script sets two of its
 * own cookies on the checkout page for fraud checks. Stripe treats them as
 * strictly necessary to take a payment, which is the ordinary reading. If a
 * lawyer disagrees, the banner comes back on that page and nowhere else.
 */

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await readLocale();
  const user = await currentUser();

  const headerUser: HeaderUser = user
    ? {
        name: user.name,
        role: user.role,
        credits: await getAvailableCredits(user.id),
        hasPhoto: await hasAvatar(user.id),
        /* The number on their face in the corner: notices from the studio they
           have not read yet. */
        unread: unreadCount(user.id),
      }
    : null;

  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        {/* Jost carries the geometric feel of the wordmark; Cormorant is the
            editorial display face. Swap to next/font later if you prefer the
            fonts self-hosted — see README. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Jost:wght@200;300;400;500&family=Cormorant+Garamond:wght@300;400;500&family=Marcellus&display=swap"
          rel="stylesheet"
        />
        <style
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html:
              `:root{--font-jost:'Jost';--font-cormorant:'Cormorant Garamond';` +
              /* the headline face, closest to the flare of the wordmark */
              `--font-wordmark:'Marcellus';}`,
          }}
        />
      </head>
      <body className="min-h-dvh bg-cream">
        <LanguageProvider initialLocale={locale}>
          {/* Reopening the installed app lands on the homepage rather than on
              whatever screen it was suspended on. Renders nothing. */}
          <ResumeHome />
          {/* The public bar and footer everywhere except the reception desk,
              which brings its own — see components/site/Chrome.tsx. */}
          <Chrome header={<Header user={headerUser} />} footer={<Footer />}>
            {children}
          </Chrome>
        </LanguageProvider>
      </body>
    </html>
  );
}
