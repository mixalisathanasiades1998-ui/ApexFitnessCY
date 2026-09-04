/**
 * Single place for the studio's real-world details.
 * Replace the placeholders marked TODO with the studio's actual data.
 */
export const STUDIO = {
  name: "APEX pilates",
  parent: "APEX Fitness Centre",
  addressLines: [
    "APEX Fitness Centre",
    "Grigori Afxentiou 9",
    "Livadia, Larnaca 7060",
    "Cyprus",
  ],
  city: "Larnaca",
  /**
   * The studio's published number, given by the studio on 4 September 2026.
   *
   * Written with the country code and spaced for reading. Every place that
   * dials it strips the spaces itself — `tel:` will not accept them — so this
   * stays the one human-readable copy: the footer, the contact page, the share
   * card at /link and the printed QR sheet all read from here.
   */
  phone: "+357 99 649 052",
  /**
   * The studio's mailbox, given by the studio on 4 September 2026.
   *
   * This is the address a member sees: the footer, the contact page and the
   * share card at /link all read it from here. It is also the mailbox the site
   * sends *from* — see `EMAIL_FROM` in .env.example — and the two being the
   * same address is the point. Mail that arrives from one address and asks to
   * be answered at another is the shape of every phishing email ever written,
   * and a member who replies to a confirmation should reach the studio.
   */
  email: "info@apexfitnesscentrecy.com",
  instagram: "https://www.instagram.com/pilatesbyapex/",
  instagramHandle: "@pilatesbyapex",
  facebook: "https://www.facebook.com/profile.php?id=61593707540014",
  /** Paste the studio's Google Maps embed URL to switch the contact map on */
  mapsEmbedUrl: "",
  /* The plain query form of the studio's Maps pin. The link copied out of the
     Maps app carries a long tail of session and telemetry parameters that go
     stale; this resolves to the same place and keeps working. */
  mapsLink:
    "https://www.google.com/maps/search/?api=1&query=Apex+Pilates%2C+Grigori+Afxentiou+9%2C+Livadia%2C+Larnaca+7060",
  /** All class times are shown in the studio's timezone, whoever is looking.
   *  "Asia/Nicosia" is the IANA zone for the whole of Cyprus, Larnaca included. */
  timezone: "Asia/Nicosia",
  /** A class is fifty minutes on the mat, in an hourly slot: the ten minutes
   *  between are the changeover, which is a real part of running five reformers
   *  and not slack. Every generated class, every template and every line of copy
   *  takes its length from here. */
  classLengthMinutes: 50,
  /** Reformers in the room, so the cap on every class */
  capacity: 5,
  /** Monday to Saturday; the studio is closed on Sunday */
  openDays: 6,
} as const;
