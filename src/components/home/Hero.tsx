"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { UserAvatar } from "@/components/account/UserAvatar";
import { ButtonLink } from "@/components/ui/Button";
import { Monogram } from "@/components/ui/Monogram";
import { HERO_BLUR_TALL, HERO_BLUR_WIDE } from "@/lib/hero-blur";
import { LOCALE_LABEL, LOCALES } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/LanguageProvider";
import { STUDIO } from "@/lib/studio";
import { cn } from "@/lib/utils";

/**
 * Whoever is looking at the cover, if anybody is.
 *
 * The header hides its own account chip over this section — it becomes a
 * centred wordmark with a MENU control, see Header.tsx — so on the home page
 * this is the only place a member can see that they are signed in, or a visitor
 * can find the way in. Hence a third thing under the two buttons rather than
 * relying on the bar above.
 */
export type HeroUser = {
  name: string;
  hasPhoto: boolean;
  credits: number;
} | null;

/**
 * The cover: full-viewport photographs of the studio with the type centred over
 * them. The header switches to its own centred-wordmark mode over this section
 * (see Header.tsx), so the composition reads as one piece.
 *
 * The photographs take turns — see HeroSlides. Faces in them are blurred,
 * cropped or turned away.
 *
 * TYPE: both lines of the headline share one face — `font-wordmark`, set to
 * Marcellus, whose flared stems echo the wordmark's lettering. To try another,
 * change `--font-wordmark` and the <link> in layout.tsx; nothing else needs
 * touching. docs/type-preview.html renders the candidates at this size.
 *
 * Both lines are sized off the *viewport*, width and height together, rather
 * than off breakpoints: the type used to be centred in the whole viewport at a
 * fixed size, so on a laptop window the first line ran straight through the
 * lockup in the bar above it. Now the headline can never grow past a share of
 * the height available to it, and the spacer below the photograph keeps it
 * clear of the bar whatever the window does.
 *
 * The entrance is CSS keyframes with staggered delays. The hero is on the
 * critical path of every first visit, so it carries no animation library.
 */
export function Hero({ user }: { user: HeroUser }) {
  const { t, fmtSessions } = useI18n();

  return (
    <section className="relative -mt-24 flex h-[100svh] min-h-[560px] flex-col overflow-hidden bg-mocha-800">
      {/* The photographs, with the scrims over them. See HeroSlides below. */}
      <div className="absolute inset-0">
        <HeroSlides />
        {/* Warm scrim: enough to carry cream type at any screen size, without
            flattening the room's light. */}
        <div className="absolute inset-0 bg-mocha-900/55" />
        <div className="absolute inset-0 bg-gradient-to-t from-mocha-900/85 via-mocha-900/20 to-mocha-900/60" />
        {/* Lifts the type off the brightest part of the room. Centred on where
            the type actually sits — a little below the middle, since the band
            reserved for the lockup pushes it down — and wide enough to cover
            the first line as well as the second. */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_66%_54%_at_50%_56%,rgba(42,32,32,0.66),transparent_72%)]" />
        <div className="absolute inset-0 grain" />
      </div>

      {/* The band reserved for the bar above, which over the cover is a centred
          wordmark with its "by APEX Fitness Centre" sub-line (Header.tsx). The
          lockup ends 79px down, so this needs to clear that and no more —
          it used to reserve 13rem, and the 8rem of dead air underneath was
          what pushed the whole composition too low down the screen. Tied to
          the viewport height so a short laptop window keeps its clearance
          without giving up half the cover to emptiness. */}
      <div aria-hidden className="h-[clamp(6.5rem,20svh,9rem)] shrink-0" />

      {/* Centred type, in the lettering of the wordmark.
          translateZ(0) is not decoration: it puts the type on its own
          compositing layer, so it is rasterised once, by itself, instead of
          being re-rasterised along with the photograph drifting underneath it.
          Without it, Windows Chrome renders some letters with parts of their
          stems missing. */}
      <div className="container-x relative flex flex-1 transform-gpu flex-col items-center justify-center overflow-hidden pb-[clamp(4rem,14svh,10rem)] text-center [@media(max-height:760px)]:pb-[clamp(1rem,5svh,3rem)] [backface-visibility:hidden]">
        {/* Two shadows, not one: a tight one to give the hairlines an edge
            against anything pale, and a softer one behind it for depth.
            Marcellus is a high-contrast face and its thin strokes are what go
            missing first over a lit background. Both blurs are kept small —
            a wide blur on type this size is an expensive raster, and expensive
            rasters are what tear. */}
        <h1 className="flex flex-col items-center [text-shadow:0_1px_2px_rgba(26,20,20,0.5),0_2px_14px_rgba(26,20,20,0.42)]">
          <span
            className="block font-wordmark text-[length:max(1.7rem,min(3.2rem,5.2vw,8svh))] uppercase leading-none tracking-[0.30em] text-cream"
          >
            {t.home.hero.kicker}
          </span>
          <span
            className="mt-2 block font-wordmark text-[length:max(4.2rem,min(10.5rem,17vw,26svh))] uppercase leading-[0.9] tracking-[0.01em] text-cream"
          >
            {t.home.hero.word}
          </span>
        </h1>

        <p
          className="mt-5 font-wordmark text-[11px] uppercase tracking-[0.62em] text-cream/85 [text-shadow:0_1px_10px_rgba(26,20,20,0.55)] sm:text-[14px]"
        >
          {STUDIO.city}
        </p>

        <div
          className="mt-[clamp(1.75rem,4.5svh,3.5rem)] flex flex-wrap items-center justify-center gap-3"
        >
          <ButtonLink href="/timetable" variant="cream" size="lg">
            {t.home.hero.primary}
          </ButtonLink>
          <ButtonLink
            href="/pricing"
            size="lg"
            className="border border-cream/35 bg-transparent text-cream hover:bg-cream hover:text-mocha-700"
          >
            {t.home.hero.secondary}
          </ButtonLink>
        </div>

        {/* Under the two buttons, deliberately quieter than both: a way in for a
            visitor, and proof of being signed in for a member. Neither is the
            thing the cover is asking anybody to do, so neither is a third
            button competing with the two above. */}
        <div className="mt-[clamp(1.1rem,2.5svh,1.75rem)]">
          {user ? (
            <Link
              /* Profile showing, and the top of the page. Somebody pressing
                 their own face is going to their account, not to a section
                 buried in it — the balance is the thing they came to see. */
              href="/account?tab=profile"
              aria-label={t.home.hero.memberAccount}
              className={cn(
                "inline-flex items-center gap-2.5 rounded-full border border-cream/30 bg-cream/[0.08] py-1.5 pl-1.5 pr-4",
                "text-cream backdrop-blur-sm transition-colors duration-500 hover:border-cream/60 hover:bg-cream/15",
              )}
            >
              <UserAvatar
                hasPhoto={user.hasPhoto}
                name={user.name}
                className="h-8 w-8 border-cream/25 bg-cream/15 text-cream"
              />
              <span className="text-[13px]">{user.name.split(" ")[0]}</span>
              <span aria-hidden className="text-cream/30">
                ·
              </span>
              {/* The number a returning member actually came to check, and the
                  header is not showing it here. */}
              <span className="text-[13px] text-cream/70 lining-nums tabular-nums">
                {fmtSessions(user.credits)}
              </span>
            </Link>
          ) : (
            /* Two lines rather than one: signing in and signing up are different
               errands, and running them together reads as a single sentence
               nobody finishes. The visitor who has no account is the larger
               group on a home page, so they get their own line. */
            <div className="space-y-1.5 text-center">
              <p className="text-[13px] text-cream/65">
                {t.home.hero.memberAsk}{" "}
                <Link
                  href="/login"
                  className="link-underline text-cream hover:text-cream"
                >
                  {t.home.hero.memberSignIn}
                </Link>
              </p>
              <p className="text-[13px] text-cream/65">
                {t.home.hero.notMemberAsk}{" "}
                <Link
                  href="/register"
                  className="link-underline text-cream hover:text-cream"
                >
                  {t.home.hero.notMemberJoin}
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* The mark closes the composition under the buttons. It is decorative,
            so it is a mask over currentColor rather than another image request
            — and on a short window it steps aside rather than being clipped in
            half by the bottom of the cover. */}
        {/* The languages, said out loud on the cover: a Russian-speaking
            visitor should not have to find a switch in a corner to learn the
            site speaks to them. The same switch as the one in the bar, laid
            out as words. */}
        <HeroLanguages />

        <Monogram
          className="mt-[clamp(1rem,2.5svh,2rem)] h-9 w-9 text-cream/45 [@media(max-height:700px)]:hidden sm:h-11 sm:w-11"
        />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ slides */

type Slide = {
  /** The crop for landscape screens, or null for a photo shown on phones only. */
  wide: string | null;
  /** The crop for portrait screens: phones, and tablets held upright. */
  tall: string;
  /** Where the crop sits on each, as CSS object-position. */
  posWide: string;
  posTall: string;
  alt: string;
};

/**
 * In the order they are shown. The first is the one every visitor sees first
 * and the only one loaded straight away, so it is the strongest on both
 * shapes of screen: a reformer, close, with nothing busy behind the type.
 *
 * The third is the class under the "Powered by Technogym" wall. On a wide
 * screen its crop is the lower part of the photograph, the class itself; on a
 * phone the whole wall fits.
 *
 * Each file is pre-cropped and pre-sized (`public/media/hero/`), because the
 * site serves images as they are: the originals are 6240px and 5–13 MB.
 */
const SLIDES: Slide[] = [
  {
    wide: "/media/hero/reformer-wide.jpg",
    tall: "/media/hero/reformer-tall.jpg",
    posWide: "50% 42%",
    posTall: "50% 50%",
    alt: "A member on a Technogym reformer at APEX pilates",
  },
  {
    wide: "/media/hero/reception-wide.jpg",
    tall: "/media/hero/reception-tall.jpg",
    /* Both crops keep the APEX sign on the wall clear of the headline: on a
       wide screen it is cropped out (the bar above already carries the name),
       on a phone it sits between the bar and the first line. */
    posWide: "50% 100%",
    posTall: "50% 50%",
    alt: "The APEX pilates reception and studio",
  },
  {
    wide: "/media/hero/sign-wide.jpg",
    tall: "/media/hero/sign-tall.jpg",
    posWide: "50% 55%",
    /* A little left of centre, so "Powered by" is not cut on a narrow phone. */
    posTall: "22% 50%",
    alt: "A class at APEX pilates under the Powered by Technogym sign",
  },
];

/** How long each photograph stays, and how long the change takes. */
const HOLD_MS = 5000;
const FADE_MS = 1200;

/**
 * The cover photographs, one after another.
 *
 * ---
 *
 * **What loads when.** The first photograph is in the HTML with high priority,
 * over a blurred copy of itself painted as the background, exactly as the single
 * cover photo was. The others are not even in the page until the first has
 * arrived: on a phone on a slow connection, the photo the visitor is looking at
 * gets the whole of the bandwidth, and the second one is fetched while the first
 * is on screen.
 *
 * **Phones get phone crops.** `<picture>` picks the tall crop on a portrait
 * screen and the wide one otherwise, so a phone never downloads a 2400px-wide
 * landscape it would show a third of. The set of photographs follows the same
 * question — the sign photo is portrait-only — and is asked again if the
 * device is turned.
 *
 * **Reduced motion.** A visitor who has asked their device for less movement
 * gets the first photograph, still: no changing, no slow zoom.
 *
 * **Server and browser agree.** The first render, on both, is the first
 * photograph alone, so there is nothing for hydration to disagree about. The
 * rest arrives after.
 */
function HeroSlides() {
  const [portrait, setPortrait] = useState(false);
  const [still, setStill] = useState(false);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);

  /* Which photographs this screen shows, as indexes into SLIDES. */
  const shown = SLIDES.flatMap((slide, i) =>
    portrait || slide.wide ? [i] : [],
  );

  useEffect(() => {
    const orientation = window.matchMedia("(orientation: portrait)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setPortrait(orientation.matches);
      setStill(motion.matches);
    };
    sync();
    orientation.addEventListener("change", sync);
    motion.addEventListener("change", sync);
    return () => {
      orientation.removeEventListener("change", sync);
      motion.removeEventListener("change", sync);
    };
  }, []);

  /* The rotation. Paused while the tab is hidden, so a visitor who comes back
     to it finds the photograph they left rather than a queue of changes. */
  const count = shown.length;
  useEffect(() => {
    if (!ready || still || count < 2) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      if (timer) return;
      timer = setInterval(() => setActive((a) => (a + 1) % count), HOLD_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ready, still, count]);

  /* The one fading out keeps its zoom until it has gone. */
  const last = useRef(active);
  useEffect(() => {
    if (last.current !== active) setPrevious(last.current);
    last.current = active;
  }, [active]);

  /* Turning the device can shrink the set; never point past its end. */
  useEffect(() => {
    if (active >= count) {
      setActive(0);
      setPrevious(null);
    }
  }, [active, count]);

  /* The first photograph is usually loaded before React is listening — it is
     in the HTML with high priority — so its load event has already fired by
     the time onLoad is attached. Ask the element instead, and keep a fallback
     for a photograph that never arrives at all. */
  const firstImage = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    if (firstImage.current?.complete) setReady(true);
    const t = setTimeout(() => setReady(true), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="absolute inset-0 bg-cover [background-image:var(--blur-wide)] [background-position:50%_42%] portrait:[background-image:var(--blur-tall)] portrait:[background-position:50%_50%]"
      style={
        {
          /* Quoted on purpose: an unquoted url() holding a base64 data URI can
             fail to parse in some browsers (the +, / and = in the payload), and
             a backdrop that fails to parse leaves the bare brown section
             showing through. */
          "--blur-wide": `url("${HERO_BLUR_WIDE}")`,
          "--blur-tall": `url("${HERO_BLUR_TALL}")`,
        } as React.CSSProperties
      }
    >
      {shown.map((index, position) => {
        const slide = SLIDES[index];
        const first = index === 0;
        if (!first && !ready) return null;
        const on = position === active;
        const leaving = position === previous;
        return (
          <picture
            key={index}
            className={cn(
              "absolute inset-0 transition-opacity ease-in-out",
              on ? "opacity-100" : "opacity-0",
            )}
            style={{ transitionDuration: `${FADE_MS}ms` }}
            aria-hidden={!on}
          >
            <source media="(orientation: portrait)" srcSet={slide.tall} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.wide ?? slide.tall}
              alt={on ? slide.alt : ""}
              /* The first is the page's largest image and the reason the cover
                 is worth waiting for; the rest are not urgent. */
              fetchPriority={first ? "high" : "low"}
              loading="eager"
              decoding={first ? "sync" : "async"}
              ref={first ? firstImage : undefined}
              onLoad={first ? () => setReady(true) : undefined}
              className={cn(
                "h-full w-full object-cover [object-position:var(--pos-wide)] portrait:[object-position:var(--pos-tall)]",
                /* The slow zoom runs while a photograph is on screen and while
                   it fades out, and restarts each time it comes back. */
                !still && (on || leaving) && "hero-drift",
              )}
              style={
                {
                  "--pos-wide": slide.posWide,
                  "--pos-tall": slide.posTall,
                } as React.CSSProperties
              }
            />
          </picture>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- languages */

/**
 * EN · ΕΛ · RU, under the buttons.
 *
 * Each label in its own script and its own `lang`, so a screen reader reads
 * "ΕΛ" in Greek. The one being read is full cream and underlined; the others
 * are quieter, like the sign-in lines above them.
 */
function HeroLanguages() {
  const { locale, setLocale } = useI18n();
  return (
    <div
      role="group"
      aria-label="Language · Γλώσσα · Язык"
      data-hero-languages
      className="mt-[clamp(1rem,3svh,2.25rem)] flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] sm:text-[12px]"
    >
      {LOCALES.map((l, i) => {
        const on = locale === l;
        return (
          <Fragment key={l}>
            {i > 0 && (
              <span aria-hidden className="text-cream/30">
                ·
              </span>
            )}
            <button
              type="button"
              lang={l}
              aria-pressed={on}
              onClick={() => setLocale(l)}
              className={cn(
                "border-b pb-0.5 pl-[0.32em] transition-colors duration-500",
                on
                  ? "border-cream/70 text-cream"
                  : "border-transparent text-cream/55 hover:text-cream",
              )}
            >
              {LOCALE_LABEL[l]}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
