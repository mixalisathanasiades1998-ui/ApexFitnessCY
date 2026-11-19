import { STUDIO } from "@/lib/studio";
import { FREE_CANCELLATION_HOURS } from "@/lib/utils";
import { MIN_AGE_YEARS } from "@/lib/profile";

/**
 * The terms, the privacy notice and the cookies page, in English, Greek and
 * Russian. The Russian is a convenience translation of the English and says so
 * in its first section, saying it is a translation of the English, that a difference is read in the
 * member's favour, and that it takes nothing away from their consumer rights.
 *
 * These used to live inside `components/marketing/LegalBody.tsx`, which was fine
 * for as long as the only place anybody read them was the page. Sign-up now asks
 * members to accept them before the account is created, and it has to show them
 * the same words: a checkbox saying "I accept the terms" next to a link that
 * opens a different document is not consent to anything.
 *
 * So the text is here and the page is one of three readers. There is exactly one
 * copy of it, and no reader can drift from another.
 *
 * ---
 *
 * **The facts are interpolated, not retyped.**
 *
 * The studio's address, mailbox, telephone number, class length, room capacity,
 * cancellation window and minimum age all come from the modules that already
 * hold them. A privacy notice that names an email address the studio no longer
 * uses is worse than no notice, and that is exactly what happens to a document
 * with the facts typed into it: the mailbox changed once already this month and
 * fifteen files had to be found.
 *
 * Every module read from here is import-pure. `legal.ts` is pulled into the
 * browser by the page and by the sign-up modal, so a constant imported from
 * something that touches the database would fail the build.
 *
 * ---
 *
 * **NOT LEGAL ADVICE, and the honest version of that warning.**
 *
 * These are written to describe what this software actually does: what it
 * stores, what it deletes, when it deletes it, and what an erasure really
 * removes. Every retention period and every named processor below was checked
 * against the code, not assumed. That makes them a far better starting point
 * than the placeholders they replace, and it does not make them a lawyer's
 * work.
 *
 * What a Cyprus lawyer should still check before launch, because none of it can
 * be read out of the code: the legal entity's registered name and number, the
 * VAT position, whether the six-year accounting retention below is the right
 * figure for this business, the liability wording, and whether the studio needs
 * to appoint anybody or register anything with the Commissioner.
 */

export type LegalKind = "privacy" | "terms" | "cookies";

/** One heading and its paragraph. */
export type LegalSection = { title: string; body: string };

/* The studio's own details, said once. */
const ADDRESS = STUDIO.addressLines.join(", ");
const MAIL = STUDIO.email;
const TEL = STUDIO.phone;
const HOURS = FREE_CANCELLATION_HOURS;
const PLACES = STUDIO.capacity;
const MINUTES = STUDIO.classLengthMinutes;
const AGE = MIN_AGE_YEARS;

/**
 * The legal entity behind the trading name, for the controller and agreement
 * clauses. These are facts on the company register and the VAT roll, and the law
 * (GDPR Art. 13, and consumer/e-commerce rules) wants the registered identity,
 * not only the name on the door. Kept here beside the other studio facts. A
 * lawyer should confirm the exact registered spelling and the VAT number before
 * this is relied on.
 */
const LEGAL_ENTITY = "M.M.A. APEX FITNESS CENTER LTD";
const COMPANY_NO = "HE 497271";
const VAT_NO = "60395665S";

/**
 * How long an unconfirmed account survives.
 *
 * Quoted from `housekeeping.ts`, where `UNVERIFIED_LIFETIME_DAYS` is the number
 * the sweep actually uses. Not imported: that module opens the database, and
 * this one is bundled into the browser. If the sweep changes, this changes.
 */
const UNVERIFIED_DAYS = 7;

/**
 * **Providers are described by category, not named.**
 *
 * "our payment provider", "an email provider", "an SMS company based in
 * Cyprus", rather than the four company names that were here before. The
 * studio asked for it, and the law allows it: the requirement is to disclose
 * "the recipients or categories of recipients", and a category is a category.
 *
 * Two things make that honest rather than evasive, and both are load-bearing:
 *
 *   1. Every one of these documents says, in the text, that the studio will
 *      name the company to anybody who writes and asks. Categories plus that
 *      offer is a recognised way of doing this. Categories plus silence is not,
 *      and if either of those sentences is ever deleted this file has quietly
 *      become a different and worse document.
 *   2. The transfer section still says which *kinds* of provider operate
 *      outside the EEA and what safeguard they rely on, because that disclosure
 *      is separately required and cannot be satisfied by a category alone.
 *
 * Worth being clear about what this does not achieve: it is presentation, not
 * secrecy. Anybody who opens their browser's developer tools on the checkout
 * page sees the payment provider's script by name. The reason to prefer
 * categories is that this page stops needing an edit every time a supplier
 * changes, which is also what it now says.
 *
 * If a lawyer wants the names back, they go back in the same places: search
 * this file for "provider", for "παρόχου" and for "провайдер".
 */

/* ------------------------------------------------------------------ privacy */

const PRIVACY_EN: LegalSection[] = [
  {
    title: "Who is responsible for your information",
    body: `${STUDIO.name}, the reformer pilates studio inside ${STUDIO.parent} at ${ADDRESS}, decides how the information described here is used. In data protection law that makes the studio the "controller". The studio is operated by ${LEGAL_ENTITY} (company registration ${COMPANY_NO}, VAT ${VAT_NO}), registered at the same address.

Write to ${MAIL} or telephone ${TEL} about anything on this page, including any of the rights set out below.

This notice describes what this website and its booking system actually hold. It is written to match the software rather than to cover every possibility, so where it says something is deleted, something is deleted.`,
  },
  {
    title: "What we hold, and why we are allowed to",
    body: `**To give you an account and take your bookings.** Your name, email address, telephone number, the language you read the site in, and an encrypted form of your password. Your bookings, the classes you attended or missed, the session packs you hold and when they expire. We need these to provide what you have asked for, so the legal basis is the performance of our contract with you.

**To take payment.** The amount, the date, the currency, which method was used, an invoice number, and the reference the payment provider gives us. Card payments are handled entirely by our payment provider: card numbers are typed into fields it controls and never reach this website or the studio. Keeping the records is both part of our contract and a legal obligation under tax law.

**To send you the messages the service needs.** Booking confirmations, cancellations, class reminders, a note the night before about the next day, payment receipts, and notices when a class or the timetable changes. These are part of holding an account and cannot be switched off, though you choose which of email, SMS and phone notifications carry them. The legal basis is our contract with you.

**To send you offers and news, only if you asked for it.** A separate, optional choice made at sign-up or in your account, on the basis of your consent. You can withdraw it at any time in My account, and withdrawing it does not affect the service messages above.

**What you tell us about your health.** See the section below. This is special-category information and we rely on your explicit consent.

**Your own optional details.** A profile photograph, date of birth, height and weight, if you choose to add them. You can leave them all blank and use the studio normally. Date of birth is held because reformer work is screened by age, not to send you birthday wishes.

**The studio's own working notes.** Brief notes kept by instructors and reception so they can teach you safely, on the basis of our legitimate interest in doing so, and which you can ask to see.

**Messages you send us.** If you use the contact form we keep your name, email address, telephone number if you gave one, and what you wrote, so somebody can reply.

**Technical information needed to keep the site working.** Which of your devices have allowed notifications, and a short description of the browser each one is, so a device that stops accepting messages can be retired.`,
  },
  {
    title: "What you tell us about your health",
    body: `When you register, and at any time afterwards in your account, you can tell us about anything we should be careful of: an injury, a condition, a pregnancy, a movement that hurts. Reception can also write it down for you if you mention it at the counter.

This is information about your health, which the law treats as needing more protection than the rest. We hold it only because you have explicitly agreed that we should, and you can withdraw that agreement or clear the answer at any time. Leaving it blank is a real answer and does not stop you booking anything.

Who sees it: the people who run the desk, and the instructor teaching a class you are booked into. It is kept out of sight on the studio's own screens until somebody needs it, because those screens sit in rooms with other people in them. It is not shown to other members anywhere, and it is never sent outside the studio.

We ask for it because five people on five reformers is a room where the instructor needs to know whose shoulder to watch. Nothing here is medical advice and the studio is not a clinic: if you are unsure whether you should be exercising, ask a doctor rather than us.`,
  },
  {
    title: "Card payments",
    body: `The studio uses a specialist payment provider to take card payments. When you pay, the card fields on the checkout page belong to that provider and are shown inside frames it controls; your card number, expiry date and security code go straight to it and are never sent to this website, never stored by it, and never seen by the studio.

What we keep is the record of the payment: how much, when, in what currency, which method, the invoice number, the provider's own reference, and a link to the receipt it hosts. That receipt shows the last four digits of the card, which is the provider's record rather than ours.

The provider is a regulated payment processor with its own responsibilities for parts of what it does, and it publishes its own privacy notice. Write to ${MAIL} and the studio will tell you which provider it uses and where that notice is.

If you pay in cash or by card at the desk, reception records the amount and the method, and no card details are held in either case.`,
  },
  {
    title: "Who else handles your information",
    body: `The studio uses a small number of companies to run this service. Each one only receives what it needs, and each is bound by a contract that allows it to use the information only for the studio's instructions.

**A hosting company** runs the website and its database, in a data centre in Frankfurt, Germany.

**A payment provider** takes card payments, as described above.

**An SMS company based in Cyprus** sends text messages. It receives a telephone number and the text of the message, and only when a message is actually sent to you by SMS.

**An email provider** carries the studio's mailbox, so any email we send you passes through it.

**A backup service** keeps an off-site copy of the studio's database, so the records can be restored if the main copy is ever lost. That copy contains everything the database holds, the health notes above included.

Two more things your browser does that are worth naming. The typefaces on this site are requested from a font service, which means that service sees the network address your device is using; the site can be changed to serve the typefaces itself if the studio prefers. And notifications are delivered by whichever push service your own browser uses, which depends on your device and which the studio has no relationship with or control over.

We do not use any analytics, advertising or tracking service. Nothing on this site reports your behaviour to anybody, and there is no third-party script anywhere on it apart from the payment provider's, which loads only on the checkout page.

**If you want the names, ask for them.** Write to ${MAIL} and the studio will tell you exactly which companies these are. They are described by what they do rather than by name so that this page does not go out of date every time a supplier changes, and not in order to keep them from you.

We do not sell your information and we never will.`,
  },
  {
    title: "Where it is kept, and whether it leaves Europe",
    body: `The database lives in Frankfurt, Germany, inside the European Union.

The payment provider and the email provider both operate outside the European Economic Area as well as inside it, and information reaching them may be transferred to countries whose laws differ from ours. Where that happens they rely on the safeguards European law provides for it, which are either a European Commission decision that the country protects information adequately, or the Commission's standard contractual clauses.

The off-site backup of the database is held by a service that operates outside the European Economic Area, under those same safeguards.`,
  },
  {
    title: "How long we keep it",
    body: `**Your account, until you ask us to erase it.** We do not delete accounts for being quiet. Somebody who trained here two years ago and comes back should find their history where they left it.

**An account that never confirmed its email address: ${UNVERIFIED_DAYS} days.** If you start registering and never enter the code, the whole record is deleted automatically after ${UNVERIFIED_DAYS} days, unless it has a payment or a booking on it. An address the studio has no relationship with is not one it should be holding.

**Confirmation codes: 24 hours after they expire.** Then the record of the code is deleted. We never store the code itself, only a value derived from it that cannot be turned back into the code.

**Payment records: six years from the end of the year they relate to.** Tax and company law in Cyprus requires it, and this is the one category we cannot delete on request while that period is running. It is why erasing a member removes who they were but leaves the fact that a payment of a certain amount happened on a certain date.

**Everything else, until you ask.** Bookings, attendance, session history and the messages we sent you stay on the account until you ask us to erase it, and then they are treated as described in the next section.

We should be straight with you about one thing: apart from the two automatic sweeps named above, nothing here deletes itself on a timer. The studio deletes on request, and does so properly.`,
  },
  {
    title: "What erasing your information actually does",
    body: `You can ask the studio to erase you and it will. Here is exactly what happens, because "we will delete your data" is a sentence that usually hides something.

**Removed completely:** your name, which becomes "Erased member"; your email address, which is replaced with a placeholder at a domain that cannot receive mail; your telephone number; your date of birth, height and weight; everything you told us about your health; your pilates level and experience; the studio's own notes about you; your profile photograph; every device registered for notifications; any half-finished confirmation code; and any message you sent us through the contact form.

Your password is replaced with one nobody holds, so the account cannot be signed into again. Marketing consent, email and SMS notifications are all switched off.

**Kept, and why:** the payments themselves, and the bookings and attendance attached to them. Not because they are convenient to keep, but because the studio's takings for last March are a sum of those rows, and deleting them would rewrite accounts that have already been filed. What is left is a record that a payment of an amount happened on a date, with no name on it. Also kept is the date on which you gave consent to be contacted, which is the evidence the studio may need precisely if you later dispute its dealings with you.

**Not automatically cancelled:** classes you are already booked into. The studio will tell you how many there are so you can decide.

If you have classes booked or a balance you have paid for, tell us what you want done with them first: erasure cannot be undone.`,
  },
  {
    title: "Your rights",
    body: `You can ask the studio to:

**Show you what it holds**, as a copy you can keep.
**Correct anything wrong.** Most of it you can also correct yourself in My account, and reception can correct the rest while you wait.
**Erase you**, as described above.
**Stop using it for a while**, if you dispute something and want it frozen rather than deleted.
**Object** to the studio's use of information where that use rests on its legitimate interests, which is the studio's own working notes.
**Hand it over in a portable form**, for the information you gave us and that we hold under our contract or your consent.
**Withdraw a consent** you gave, at any time. Offers and news are switched off in My account with one press. Health information can be cleared the same way. Withdrawing consent does not undo anything done while it was in force.

Ask by writing to ${MAIL}. The studio will reply within one month, and will tell you if it needs longer and why. There is nothing to pay.

If you are not satisfied with how the studio has answered, you can complain to the Office of the Commissioner for Personal Data Protection in Cyprus, at commissioner@dataprotection.gov.cy or www.dataprotection.gov.cy. You can complain to them without asking us first, though we would rather have the chance to put it right.`,
  },
  {
    title: "Decisions, and how the studio chooses who to write to",
    body: `Nothing on this site makes an automated decision about you that has a legal or similarly significant effect. No algorithm decides whether you may book, what you pay, or whether you are welcome.

When the studio sends an announcement it can narrow the list, for example to members who have not been for a while. That is a filter on who receives a message, applied by a person who then presses send. It changes nothing about your account and has no consequence beyond whether one message arrives.`,
  },
  {
    title: "Age",
    body: `Accounts are for people aged ${AGE} and over. The site asks for a date of birth if you choose to give one and will not accept one that makes you younger than ${AGE}.

The studio does not knowingly hold information about children. If you believe a child has registered, write to ${MAIL} and it will be removed.`,
  },
  {
    title: "How your information is protected",
    body: `Passwords are never stored. What is stored is a value produced from your password by a one-way function designed to be slow to attack, and it cannot be turned back into your password. Nobody at the studio can read it or tell you what your password is.

The whole site is served over an encrypted connection. Confirmation codes are stored the same way as passwords, as a derived value rather than the code.

Inside the studio, access is divided on purpose: the people at the desk can see what they need in order to serve you and no more, and the studio's own figures are not part of that. Staff screens in public parts of the building ask for a password of their own and lock themselves when they are left alone.

No system is perfect. If something does go wrong and it is likely to put you at risk, the studio will tell you and the Commissioner, as the law requires.`,
  },
  {
    title: "Cookies",
    body: `This site sets three cookies and stores one preference on your device. None of them is for advertising or tracking, and there is no analytics of any kind.

The cookies page sets out each one, what it is for, how long it lasts, and how to remove it.`,
  },
  {
    title: "Changes to this notice",
    body: `If the studio changes how it uses your information, this page changes with it and the date below changes too. Where a change matters to you, you will hear about it rather than being left to notice it.

Last updated: September 2026.`,
  },
];

/* -------------------------------------------------------------------- terms */

const TERMS_EN: LegalSection[] = [
  {
    title: "Who you are dealing with",
    body: `These terms are the agreement between you and ${STUDIO.name}, the reformer pilates studio inside ${STUDIO.parent} at ${ADDRESS}, operated by ${LEGAL_ENTITY} (company registration ${COMPANY_NO}, VAT ${VAT_NO}).

Contact: ${MAIL}, ${TEL}.

By creating an account, booking a class or buying a pack, you agree to what is on this page. Please read it: the parts about cancellation and about your health are the ones people most often wish they had read.`,
  },
  {
    title: "Your account",
    body: `You need an account to book. Give a real name, a real email address and a real telephone number: the studio uses all three to reach you when a class moves.

You confirm your email address with a six-digit code. Until you do, the account cannot book or pay, and if it is never confirmed it is deleted after ${UNVERIFIED_DAYS} days.

One telephone number belongs to one account. Two people cannot share one, because two people sharing a number is two members reception cannot tell apart on the telephone.

Accounts are for people aged ${AGE} and over. Keep your password to yourself; anything done from your account is treated as done by you.`,
  },
  {
    title: "What you are buying",
    body: `You buy sessions, not time. A pack is a number of sessions with a date by which they must be used, and both numbers are shown before you pay and again on your account.

A day pass is one session. A monthly or term pack is a number of sessions a week over that term. An Unlimited plan means as many classes as you like within the term with a limit of one class a day; that daily limit is part of the product and not an oversight.

Sessions belong to the account that bought them. They cannot be given away, sold, shared or transferred to somebody else, and a Duet is the exception that proves the rule: it is one session that admits two people, booked by the member who holds it.

Personal and Duet sessions buy an hour with an instructor and cannot be spent on a group class. Group sessions cannot be spent on an appointment. The two are priced differently and are not interchangeable in either direction.`,
  },
  {
    title: "Booking a class",
    body: `There are ${PLACES} reformers in the room, so a class has ${PLACES} places and a full class is genuinely full. Each class is ${MINUTES} minutes on the mat within an hourly slot; the rest of the hour is the changeover.

One session buys one place in one class. You can book as far ahead as the timetable runs, and you can book the same slot for a run of weeks in one go.

Personal and Duet hours run at midday on weekdays and must be booked by the end of the day before, so that an instructor can be arranged. A Duet is booked by one of the two people, who gives the other person's name.

If you book a class your sessions cannot cover, or your pack expires before the class runs, the site will tell you which and why rather than taking the booking and sorting it out later.`,
  },
  {
    title: "Cancelling, and missing a class",
    body: `**More than ${HOURS} hours before the class: cancel and the session comes back.** One press, no reason needed, and it returns to the pack it came from with that pack's original expiry date.

**Less than ${HOURS} hours before: you can still cancel, and the session is not returned.** The site will say so plainly and ask you to confirm before it does anything. Please do cancel anyway: it frees your place for somebody else, and it tells the instructor not to expect you.

**Not turning up at all** is treated the same way as a late cancellation, except that nobody gets your place.

**Personal and Duet hours** close to free cancellation at the end of the day before, for the same reason they close to booking then: an instructor has already been asked to come in and that hour is worked either way. After that you can still cancel, and the session is not returned.

**Reception can override any of this.** If you ring the studio with a good reason, the person you speak to decides, and they can return the session whatever the clock says. That is deliberate: a rule that cannot be bent by somebody who knows the situation is a rule that punishes the wrong people.`,
  },
  {
    title: "Paying",
    body: `You can pay by card on this site, or by cash or card at the desk. Prices are in euro and include VAT where it applies.

Card payments on the site are taken by a specialist payment provider, and the studio never sees or holds your card number. A VAT invoice is attached to the confirmation of every card payment made online.

Sessions are added to your balance as soon as the payment is confirmed. If a payment is taken and the sessions do not appear, tell the studio and it will be put right; the payment provider's record is what settles any disagreement about whether money moved.`,
  },
  {
    title: "Refunds and expiry",
    body: `Unused sessions are not refunded in money, and they are not extended because you were away, ill or busy. The expiry date is part of what you bought, and it is shown before you pay and on your account afterwards.

That is the rule, and reception can be asked. Illness, injury, pregnancy and a change in your circumstances are exactly the cases the studio would rather hear about than enforce a date against. Ask.

If the studio cancels a class you had booked, the session goes back to your balance and you have not lost anything. If the studio closes for a period long enough to threaten your expiry date, it will move the date rather than let it run out.

Buying online is a distance contract, and consumer law gives you fourteen days to change your mind about one. That right does not extend to sessions you have already used, and a class you have attended has been provided. If you have bought a pack and used none of it, write within fourteen days and the studio will refund it.`,
  },
  {
    title: "Free and promotional sessions",
    body: `From time to time the studio gives a session for free, such as an opening offer to new members. A free session follows the same rules as any other, and a few of its own.

It is granted to accounts that qualify during the offer's dates, one per account, and whether you qualify is decided by when your account was created rather than by anything you do afterwards.

It can only be spent on classes inside the offer's own window, which is shown to you when the session is given and is usually shorter than a bought pack. It expires on the date shown and is not extended.

A free session is not refundable in money, cannot be transferred or shared, and the studio can change or withdraw an offer at any time. Sessions already given are honoured on the terms they were given on.`,
  },
  {
    title: "Your health, and being honest with us",
    body: `Reformer pilates is exercise on a machine with springs. By booking you confirm that you are well enough to take part and that nothing you know of makes it unsafe for you.

Tell the studio anything it should be careful of: an injury, a condition, a recent operation, a pregnancy, a movement that hurts. There is a box for it when you register and in your account, and reception will write it down if you would rather say it out loud. It stays between you, the desk and the instructor teaching your class.

If something changes, tell us. An instructor who does not know about your shoulder cannot work around it.

The studio's instructors are qualified to teach pilates and are not doctors. Nothing they or this site tell you is medical advice. If you are unsure whether you should be exercising, ask a doctor first, and please do that rather than asking us to decide.

An instructor may change an exercise for you, ask you not to do one, or ask you to sit a class out, if in their judgement it is not safe. That judgement is theirs and it is final in the room.`,
  },
  {
    title: "In the studio",
    body: `Arrive a few minutes early. A ${MINUTES}-minute class starting on the hour cannot wait, and an instructor cannot safely set somebody up on a reformer while the class is already moving; if you arrive after a class has begun you may be asked to sit it out, and that counts as a class taken.

Grip socks are required, for hygiene and because bare feet slip on a moving carriage.

Please treat the equipment, the instructors and the other four people in the room with care. The studio can ask somebody to leave, and in a serious case can close their account, if their behaviour makes the room unsafe or unpleasant for anybody else. Sessions are not refunded in that case.`,
  },
  {
    title: "Changes the studio makes",
    body: `The timetable, the instructors and the prices can change. Where a change affects a class you have already booked you will be told, and where a class is cancelled the session comes back.

The instructor named on a class is the studio's intention rather than a promise: rotas change, people are ill, and the class still runs. You are told when the name changes on a class you hold.

Prices change only forwards. A pack you have already bought keeps the price you paid and the terms you bought it on.

The studio closes on public holidays and can close for maintenance or for reasons outside its control. Closures are announced, bookings inside them are cancelled and the sessions returned.`,
  },
  {
    title: "If something goes wrong",
    body: `The studio is responsible for providing the classes you have paid for with reasonable skill and care, and for keeping its equipment properly maintained.

It is not responsible for injury that comes from ignoring an instructor's instruction, from using equipment in a way you were told not to, or from a condition you chose not to tell us about. It is not responsible for belongings left in the studio.

Nothing in these terms limits anything that cannot lawfully be limited, including liability for death or personal injury caused by negligence, or for fraud. Your rights as a consumer under Cypriot and European law stand whatever this page says, and where anything here conflicts with them, they win.`,
  },
  {
    title: "Complaints, and the law that applies",
    body: `If something is wrong, tell the studio first: ${MAIL}, or ${TEL}, or the person at the desk. Most of it can be settled in a conversation.

These terms are governed by the law of the Republic of Cyprus, and the Cypriot courts have jurisdiction. As a consumer you keep the right to bring proceedings where you live.

The studio can change these terms. If a change matters to you, you will be told rather than left to find it. Continuing to use your account after a change means accepting the version that is here.

Last updated: November 2026.`,
  },
];

/* ------------------------------------------------------------------ cookies */

const COOKIES_EN: LegalSection[] = [
  {
    title: "The short version",
    body: `This site has no advertising, no analytics and no tracking of any kind. Nothing here reports what you look at to anybody, and there is no third-party script on any page except the checkout, where the payment provider's card fields load.

What it does store is three cookies and one preference, listed below. Two of the cookies are how the site knows you are signed in; without them it cannot work at all. The third remembers which language you chose.

There is no pop-up asking you to agree to any of this, and that is deliberate rather than an oversight. Two of the cookies are strictly necessary, which needs no permission. The third is written only in the instant you press the language switch, which is you asking for it. Nothing optional is put on your device before you do something that asks for it.`,
  },
  {
    title: "Strictly necessary, and not optional",
    body: `**apex_session.** Set when you sign in, and it is what keeps you signed in. It holds a signed token containing your account id, your name, your email address and your role. It cannot be read by any script, including ours, and it lasts thirty days or until you sign out.

**apex_desk.** For the studio's own staff only. The desk console asks for a password again even when somebody is already signed in, and this remembers that it was given. It lasts fifteen minutes of inactivity and then the console locks itself, because it sits on a counter in a room the public walks through.

Neither of these is set before you sign in, and neither can be refused while you are signed in: they are not a way of learning anything about you, they are the mechanism by which the site knows who is asking.`,
  },
  {
    title: "A preference, set only when you ask for it",
    body: `**apex_locale.** Remembers whether you are reading the site in English, Greek or Russian, so it opens in the right language next time. Set the moment you use the language switch, lasts a year, and contains nothing but "en", "el" or "ru".

**The notification reminder.** If you decline the prompt asking whether you want class reminders on your phone, that decision is remembered in your browser's own storage so you are not asked again on that device. It contains a date and nothing else, it never leaves your device, and the studio cannot read it.

Neither of these appears unless you act. Never touch the language switch and there is no apex_locale at all; never decline the notification prompt and there is nothing remembered. Delete them and the site still works: it will simply open in its default language each time, and may ask again about notifications.`,
  },
  {
    title: "The payment provider, on the checkout page only",
    body: `When you go to pay, the card fields are provided by the studio's payment provider, which sets its own cookies to spot fraud and to keep a payment attempt together across a page reload.

They load only on the checkout page, only when you are signed in and actually paying, and they are necessary to take a payment safely. The provider publishes its own cookie policy; write to ${MAIL} and the studio will tell you which provider it is and where to read it.

The studio cannot switch these off and still take card payments. If you would rather not have them, pay at the desk.`,
  },
  {
    title: "Other requests your browser makes",
    body: `Two things are worth naming even though they set no cookie, because a page about cookies that said nothing about these would be a strange kind of honesty.

**Typefaces.** The fonts on this site are requested from an outside font service, which means that service sees the network address your device is using and what kind of browser it is. No cookie is set and nothing is stored on your device. The studio can serve the fonts itself instead, which would remove the request entirely, and it is a single change if you would prefer that: say so.

**Notifications.** If you turn on class reminders, they are delivered through whichever push service your own browser uses, which depends on your device. That relationship is between your browser and its maker; the studio holds only the address that service gives it for your device, and deletes it when you turn notifications off.

Deleting the cookies above does not stop either of these, and it would be misleading to imply otherwise. The first is a request for a file; the second only happens if you ask for it.`,
  },
  {
    title: "Removing them, with your browser's own controls",
    body: `Every browser can list the cookies a site has set and delete them, usually under Privacy or Site settings. Clearing them for this site removes the language cookie and the notification reminder together, and the site puts back only what you ask it to put back.

Your browser can also block cookies outright. Blocking the two necessary ones will stop you being able to sign in, which is not the site being awkward: signing in is what those cookies are.

Last updated: November 2026.`,
  },
];

/* -------------------------------------------------------------------- Greek */

const PRIVACY_EL: LegalSection[] = [
  {
    title: "Ποιος είναι υπεύθυνος για τα στοιχεία σου",
    body: `Το ${STUDIO.name}, το στούντιο reformer pilates μέσα στο ${STUDIO.parent} στη διεύθυνση ${ADDRESS}, αποφασίζει πώς χρησιμοποιούνται τα στοιχεία που περιγράφονται εδώ. Στη νομοθεσία προστασίας δεδομένων αυτό κάνει το στούντιο "υπεύθυνο επεξεργασίας". Το στούντιο λειτουργεί από την ${LEGAL_ENTITY} (αριθμός εγγραφής εταιρείας ${COMPANY_NO}, ΦΠΑ ${VAT_NO}), με έδρα την ίδια διεύθυνση.

Γράψε στο ${MAIL} ή τηλεφώνησε στο ${TEL} για οτιδήποτε σε αυτή τη σελίδα, συμπεριλαμβανομένων των δικαιωμάτων που αναφέρονται παρακάτω.

Το κείμενο αυτό περιγράφει τι κρατά πραγματικά αυτή η ιστοσελίδα και το σύστημα κρατήσεων. Είναι γραμμένο για να ταιριάζει με το λογισμικό και όχι για να καλύψει κάθε πιθανότητα, οπότε όπου λέει ότι κάτι διαγράφεται, διαγράφεται.`,
  },
  {
    title: "Τι κρατάμε, και με ποια βάση",
    body: `**Για τον λογαριασμό και τις κρατήσεις σου.** Το όνομά σου, το email, το τηλέφωνο, τη γλώσσα στην οποία διαβάζεις τη σελίδα, και μια κρυπτογραφημένη μορφή του κωδικού σου. Τις κρατήσεις σου, τα μαθήματα που ήρθες ή έχασες, τα πακέτα συνεδριών που έχεις και πότε λήγουν. Τα χρειαζόμαστε για να σου παρέχουμε αυτό που ζήτησες, οπότε η νομική βάση είναι η εκτέλεση της σύμβασής μας.

**Για την πληρωμή.** Το ποσό, την ημερομηνία, το νόμισμα, τον τρόπο πληρωμής, τον αριθμό τιμολογίου και την αναφορά που μας δίνει ο πάροχος πληρωμών. Οι πληρωμές με κάρτα γίνονται εξ ολοκλήρου μέσω του παρόχου πληρωμών μας: οι αριθμοί καρτών πληκτρολογούνται σε πεδία που ελέγχει εκείνος και δεν φτάνουν ποτέ σε αυτή την ιστοσελίδα ούτε στο στούντιο. Η διατήρηση των εγγραφών είναι μέρος της σύμβασης και ταυτόχρονα νομική υποχρέωση από τη φορολογική νομοθεσία.

**Για τα μηνύματα που χρειάζεται η υπηρεσία.** Επιβεβαιώσεις κρατήσεων, ακυρώσεις, υπενθυμίσεις μαθημάτων, μια σημείωση το βράδυ για την επόμενη μέρα, αποδείξεις πληρωμής και ειδοποιήσεις όταν αλλάζει ένα μάθημα ή το πρόγραμμα. Αυτά είναι μέρος του να έχεις λογαριασμό και δεν απενεργοποιούνται, αλλά επιλέγεις ποια από email, SMS και ειδοποιήσεις κινητού τα μεταφέρουν. Η νομική βάση είναι η σύμβασή μας.

**Για προσφορές και νέα, μόνο αν το ζήτησες.** Ξεχωριστή, προαιρετική επιλογή στην εγγραφή ή στον λογαριασμό σου, με βάση τη συγκατάθεσή σου. Μπορείς να την ανακαλέσεις οποτεδήποτε από τον λογαριασμό σου, και αυτό δεν επηρεάζει τα μηνύματα υπηρεσίας παραπάνω.

**Ό,τι μας λες για την υγεία σου.** Δες την ενότητα παρακάτω. Είναι δεδομένα ειδικής κατηγορίας και βασιζόμαστε στη ρητή συγκατάθεσή σου.

**Τα δικά σου προαιρετικά στοιχεία.** Φωτογραφία προφίλ, ημερομηνία γέννησης, ύψος και βάρος, αν θέλεις να τα προσθέσεις. Μπορείς να τα αφήσεις όλα κενά και να χρησιμοποιείς κανονικά το στούντιο. Η ημερομηνία γέννησης κρατείται γιατί η άσκηση στο reformer αξιολογείται και με βάση την ηλικία, όχι για ευχές γενεθλίων.

**Οι σημειώσεις εργασίας του στούντιο.** Σύντομες σημειώσεις που κρατούν οι εκπαιδευτές και η υποδοχή ώστε να σε διδάσκουν με ασφάλεια, με βάση το έννομο συμφέρον μας, και τις οποίες μπορείς να ζητήσεις να δεις.

**Μηνύματα που μας στέλνεις.** Αν χρησιμοποιήσεις τη φόρμα επικοινωνίας κρατάμε το όνομά σου, το email, το τηλέφωνο αν το έδωσες και ό,τι έγραψες, ώστε κάποιος να απαντήσει.

**Τεχνικές πληροφορίες για να δουλεύει η σελίδα.** Ποιες συσκευές σου έχουν επιτρέψει ειδοποιήσεις και μια σύντομη περιγραφή του browser της κάθε μιας, ώστε μια συσκευή που σταματά να δέχεται μηνύματα να αποσύρεται.`,
  },
  {
    title: "Ό,τι μας λες για την υγεία σου",
    body: `Στην εγγραφή, και οποτεδήποτε μετά από τον λογαριασμό σου, μπορείς να μας πεις για ό,τι πρέπει να προσέχουμε: έναν τραυματισμό, μια κατάσταση, μια εγκυμοσύνη, μια κίνηση που πονά. Η υποδοχή μπορεί να το γράψει και για σένα αν το αναφέρεις στον πάγκο.

Είναι πληροφορία για την υγεία σου, την οποία ο νόμος θεωρεί ότι χρειάζεται περισσότερη προστασία. Την κρατάμε μόνο επειδή έχεις συμφωνήσει ρητά, και μπορείς να ανακαλέσεις τη συμφωνία ή να καθαρίσεις την απάντηση οποτεδήποτε. Το να το αφήσεις κενό είναι πραγματική απάντηση και δεν σε εμποδίζει να κλείσεις τίποτα.

Ποιος τη βλέπει: όσοι δουλεύουν στην υποδοχή, και ο εκπαιδευτής του μαθήματος στο οποίο έχεις κράτηση. Μένει κρυμμένη στις οθόνες του στούντιο μέχρι να τη χρειαστεί κάποιος, γιατί εκείνες οι οθόνες βρίσκονται σε χώρους με άλλους ανθρώπους. Δεν εμφανίζεται σε άλλα μέλη πουθενά και δεν στέλνεται ποτέ έξω από το στούντιο.

Τη ζητάμε γιατί πέντε άνθρωποι σε πέντε reformer είναι ένας χώρος όπου ο εκπαιδευτής πρέπει να ξέρει ποιον ώμο να προσέχει. Τίποτα εδώ δεν είναι ιατρική συμβουλή και το στούντιο δεν είναι κλινική: αν δεν είσαι σίγουρος αν πρέπει να ασκείσαι, ρώτησε γιατρό και όχι εμάς.`,
  },
  {
    title: "Πληρωμές με κάρτα",
    body: `Το στούντιο χρησιμοποιεί εξειδικευμένο πάροχο πληρωμών για τις πληρωμές με κάρτα. Όταν πληρώνεις, τα πεδία της κάρτας στη σελίδα πληρωμής ανήκουν σε εκείνον και εμφανίζονται μέσα σε πλαίσια που ελέγχει εκείνος· ο αριθμός, η ημερομηνία λήξης και ο κωδικός ασφαλείας πηγαίνουν απευθείας σε εκείνον και δεν στέλνονται ποτέ σε αυτή την ιστοσελίδα, δεν αποθηκεύονται από αυτήν και δεν τα βλέπει το στούντιο.

Ό,τι κρατάμε είναι η εγγραφή της πληρωμής: πόσο, πότε, σε ποιο νόμισμα, με ποιον τρόπο, ο αριθμός τιμολογίου, η αναφορά του παρόχου και ένας σύνδεσμος στην απόδειξη που φιλοξενεί εκείνος. Εκείνη η απόδειξη δείχνει τα τέσσερα τελευταία ψηφία της κάρτας, που είναι εγγραφή του παρόχου και όχι δική μας.

Ο πάροχος είναι ρυθμιζόμενος επεξεργαστής πληρωμών με τις δικές του ευθύνες για ορισμένα μέρη όσων κάνει, και δημοσιεύει τη δική του πολιτική απορρήτου. Γράψε στο ${MAIL} και το στούντιο θα σου πει ποιον πάροχο χρησιμοποιεί και πού βρίσκεται εκείνη η πολιτική.

Αν πληρώσεις με μετρητά ή με κάρτα στην υποδοχή, η υποδοχή καταγράφει το ποσό και τον τρόπο, και σε καμία περίπτωση δεν κρατούνται στοιχεία κάρτας.`,
  },
  {
    title: "Ποιος άλλος επεξεργάζεται τα στοιχεία σου",
    body: `Το στούντιο χρησιμοποιεί λίγες εταιρείες για να λειτουργεί αυτή η υπηρεσία. Κάθε μία λαμβάνει μόνο ό,τι χρειάζεται και δεσμεύεται από σύμβαση που της επιτρέπει να τα χρησιμοποιεί μόνο κατ' εντολή του στούντιο.

**Εταιρεία φιλοξενίας**: φιλοξενεί την ιστοσελίδα και τη βάση δεδομένων, σε κέντρο δεδομένων στη Φρανκφούρτη της Γερμανίας.

**Πάροχος πληρωμών**: οι πληρωμές με κάρτα, όπως παραπάνω.

**Εταιρεία SMS με έδρα την Κύπρο**: στέλνει τα γραπτά μηνύματα. Λαμβάνει μόνο έναν αριθμό τηλεφώνου και το κείμενο του μηνύματος, και μόνο όταν σου σταλεί όντως SMS.

**Πάροχος ηλεκτρονικού ταχυδρομείου**: μεταφέρει την αλληλογραφία του στούντιο, οπότε κάθε email που σου στέλνουμε περνά από εκεί.

**Υπηρεσία αντιγράφων ασφαλείας**: κρατά ένα αντίγραφο της βάσης δεδομένων εκτός του κύριου συστήματος, ώστε τα αρχεία να ανακτηθούν αν χαθεί ποτέ το κύριο αντίγραφο. Το αντίγραφο αυτό περιέχει ό,τι κρατά η βάση, συμπεριλαμβανομένων των σημειώσεων υγείας παραπάνω.

Δύο ακόμη πράγματα που κάνει ο browser σου αξίζουν αναφορά. Οι γραμματοσειρές αυτής της σελίδας ζητούνται από μια υπηρεσία γραμματοσειρών, που σημαίνει ότι εκείνη βλέπει τη διεύθυνση δικτύου που χρησιμοποιεί η συσκευή σου· η σελίδα μπορεί να αλλάξει ώστε να σερβίρει μόνη της τις γραμματοσειρές, αν το προτιμήσει το στούντιο. Και οι ειδοποιήσεις παραδίδονται από την υπηρεσία push του δικού σου browser, που εξαρτάται από τη συσκευή σου και με την οποία το στούντιο δεν έχει σχέση ούτε έλεγχο.

Δεν χρησιμοποιούμε καμία υπηρεσία στατιστικών, διαφήμισης ή παρακολούθησης. Τίποτα σε αυτή τη σελίδα δεν αναφέρει σε κανέναν τη συμπεριφορά σου, και δεν υπάρχει σενάριο τρίτου πουθενά εκτός από του παρόχου πληρωμών, που φορτώνει μόνο στη σελίδα πληρωμής.

**Αν θέλεις τα ονόματα, ζήτησέ τα.** Γράψε στο ${MAIL} και το στούντιο θα σου πει ποιες εταιρείες είναι ακριβώς. Περιγράφονται με βάση τι κάνουν και όχι με το όνομά τους ώστε η σελίδα να μην παλιώνει κάθε φορά που αλλάζει προμηθευτής, και όχι για να σου κρυφτούν.

Δεν πουλάμε τα στοιχεία σου και δεν θα τα πουλήσουμε ποτέ.`,
  },
  {
    title: "Πού κρατούνται, και αν φεύγουν από την Ευρώπη",
    body: `Η βάση δεδομένων βρίσκεται στη Φρανκφούρτη της Γερμανίας, μέσα στην Ευρωπαϊκή Ένωση.

Ο πάροχος πληρωμών και ο πάροχος ηλεκτρονικού ταχυδρομείου λειτουργούν και εκτός του Ευρωπαϊκού Οικονομικού Χώρου, και στοιχεία που φτάνουν σε αυτούς μπορεί να μεταφερθούν σε χώρες με διαφορετική νομοθεσία. Όπου συμβαίνει αυτό, βασίζονται στις εγγυήσεις που προβλέπει το ευρωπαϊκό δίκαιο, δηλαδή είτε απόφαση επάρκειας της Ευρωπαϊκής Επιτροπής είτε τις τυποποιημένες συμβατικές ρήτρες της.

Το εξωτερικό αντίγραφο ασφαλείας της βάσης δεδομένων φυλάσσεται από υπηρεσία που λειτουργεί εκτός του Ευρωπαϊκού Οικονομικού Χώρου, με τις ίδιες εγγυήσεις.`,
  },
  {
    title: "Πόσο καιρό τα κρατάμε",
    body: `**Τον λογαριασμό σου, μέχρι να ζητήσεις τη διαγραφή του.** Δεν διαγράφουμε λογαριασμούς επειδή έμειναν ήσυχοι. Όποιος γυμναζόταν εδώ πριν δύο χρόνια και επιστρέψει πρέπει να βρει το ιστορικό του όπως το άφησε.

**Λογαριασμός που δεν επιβεβαίωσε ποτέ το email του: ${UNVERIFIED_DAYS} ημέρες.** Αν αρχίσεις εγγραφή και δεν βάλεις ποτέ τον κωδικό, όλη η εγγραφή διαγράφεται αυτόματα μετά από ${UNVERIFIED_DAYS} ημέρες, εκτός αν έχει πληρωμή ή κράτηση. Μια διεύθυνση με την οποία το στούντιο δεν έχει καμία σχέση δεν είναι διεύθυνση που πρέπει να κρατά.

**Κωδικοί επιβεβαίωσης: 24 ώρες μετά τη λήξη τους.** Τότε διαγράφεται η εγγραφή του κωδικού. Δεν αποθηκεύουμε ποτέ τον ίδιο τον κωδικό, μόνο μια τιμή που παράγεται από αυτόν και δεν μπορεί να αντιστραφεί.

**Εγγραφές πληρωμών: έξι χρόνια από το τέλος του έτους στο οποίο αναφέρονται.** Το απαιτεί η φορολογική και εταιρική νομοθεσία της Κύπρου, και είναι η μόνη κατηγορία που δεν μπορούμε να διαγράψουμε κατόπιν αιτήματος όσο τρέχει αυτή η περίοδος. Γι' αυτό η διαγραφή ενός μέλους αφαιρεί το ποιος ήταν, αλλά αφήνει το γεγονός ότι μια πληρωμή ενός συγκεκριμένου ποσού έγινε μια συγκεκριμένη ημερομηνία.

**Όλα τα άλλα, μέχρι να ζητήσεις.** Κρατήσεις, παρουσίες, ιστορικό συνεδριών και τα μηνύματα που σου στείλαμε μένουν στον λογαριασμό μέχρι να ζητήσεις διαγραφή, και τότε αντιμετωπίζονται όπως περιγράφεται στην επόμενη ενότητα.

Να είμαστε ευθείς σε ένα πράγμα: πέρα από τους δύο αυτόματους καθαρισμούς παραπάνω, τίποτα εδώ δεν διαγράφεται μόνο του με χρονόμετρο. Το στούντιο διαγράφει κατόπιν αιτήματος, και το κάνει σωστά.`,
  },
  {
    title: "Τι κάνει πραγματικά η διαγραφή",
    body: `Μπορείς να ζητήσεις από το στούντιο να σε διαγράψει και θα το κάνει. Ορίστε τι γίνεται ακριβώς, γιατί το "θα διαγράψουμε τα δεδομένα σου" είναι φράση που συνήθως κρύβει κάτι.

**Αφαιρούνται εντελώς:** το όνομά σου, που γίνεται "Erased member" (Διαγραμμένο μέλος)· το email σου, που αντικαθίσταται με πλαστό σε τομέα που δεν μπορεί να λάβει αλληλογραφία· το τηλέφωνο· η ημερομηνία γέννησης, το ύψος και το βάρος· όλα όσα μας είπες για την υγεία σου· το επίπεδο και η εμπειρία σου στο pilates· οι δικές μας σημειώσεις για σένα· η φωτογραφία προφίλ· κάθε συσκευή που είχε εγγραφεί για ειδοποιήσεις· κάθε μισοτελειωμένος κωδικός επιβεβαίωσης· και κάθε μήνυμα που μας έστειλες μέσω της φόρμας επικοινωνίας.

Ο κωδικός σου αντικαθίσταται με έναν που δεν τον έχει κανείς, οπότε δεν γίνεται πλέον σύνδεση. Η συγκατάθεση για προσφορές και οι ειδοποιήσεις email και SMS απενεργοποιούνται.

**Κρατούνται, και γιατί:** οι ίδιες οι πληρωμές, και οι κρατήσεις και οι παρουσίες που συνδέονται με αυτές. Όχι επειδή είναι βολικό, αλλά επειδή τα έσοδα του στούντιο για τον περασμένο Μάρτιο είναι το άθροισμα αυτών των γραμμών, και η διαγραφή τους θα ξανάγραφε λογαριασμούς που έχουν ήδη υποβληθεί. Ό,τι μένει είναι η εγγραφή ότι μια πληρωμή ενός ποσού έγινε μια ημερομηνία, χωρίς όνομα. Κρατείται επίσης η ημερομηνία που έδωσες συγκατάθεση επικοινωνίας, που είναι το τεκμήριο που μπορεί να χρειαστεί το στούντιο ακριβώς αν αργότερα αμφισβητήσεις τη σχέση σου με αυτό.

**Δεν ακυρώνονται αυτόματα:** τα μαθήματα στα οποία είσαι ήδη κρατημένος. Το στούντιο θα σου πει πόσα είναι για να αποφασίσεις.

Αν έχεις κρατήσεις ή υπόλοιπο που έχεις πληρώσει, πες μας πρώτα τι θέλεις να γίνει με αυτά: η διαγραφή δεν αναστρέφεται.`,
  },
  {
    title: "Τα δικαιώματά σου",
    body: `Μπορείς να ζητήσεις από το στούντιο:

**Να σου δείξει τι κρατά**, σε αντίγραφο που μπορείς να κρατήσεις.
**Να διορθώσει ό,τι είναι λάθος.** Τα περισσότερα τα διορθώνεις και μόνος σου στον λογαριασμό σου, και η υποδοχή διορθώνει τα υπόλοιπα επί τόπου.
**Να σε διαγράψει**, όπως παραπάνω.
**Να σταματήσει τη χρήση για ένα διάστημα**, αν αμφισβητείς κάτι και θέλεις να παγώσει αντί να διαγραφεί.
**Να εναντιωθείς** στη χρήση που βασίζεται στο έννομο συμφέρον, δηλαδή στις σημειώσεις εργασίας του στούντιο.
**Να τα παραδώσει σε φορητή μορφή**, για όσα μας έδωσες και κρατάμε βάσει σύμβασης ή συγκατάθεσης.
**Να ανακαλέσεις συγκατάθεση** οποτεδήποτε. Οι προσφορές και τα νέα απενεργοποιούνται με ένα πάτημα στον λογαριασμό σου. Τα στοιχεία υγείας καθαρίζονται με τον ίδιο τρόπο. Η ανάκληση δεν αναιρεί ό,τι έγινε όσο ίσχυε.

Ζήτησέ το γράφοντας στο ${MAIL}. Το στούντιο απαντά μέσα σε έναν μήνα, και θα σου πει αν χρειάζεται περισσότερο και γιατί. Δεν υπάρχει χρέωση.

Αν δεν μείνεις ικανοποιημένος με την απάντηση του στούντιο, μπορείς να παραπονεθείς στο Γραφείο Επιτρόπου Προστασίας Δεδομένων Προσωπικού Χαρακτήρα Κύπρου, στο commissioner@dataprotection.gov.cy ή στο www.dataprotection.gov.cy. Μπορείς να απευθυνθείς σε αυτούς χωρίς να ρωτήσεις πρώτα εμάς, αν και θα προτιμούσαμε να έχουμε την ευκαιρία να το διορθώσουμε.`,
  },
  {
    title: "Αποφάσεις, και πώς επιλέγεται σε ποιον γράφουμε",
    body: `Τίποτα σε αυτή τη σελίδα δεν παίρνει αυτοματοποιημένη απόφαση για σένα με νομικές ή αντίστοιχα σημαντικές συνέπειες. Κανένας αλγόριθμος δεν αποφασίζει αν μπορείς να κλείσεις μάθημα, τι πληρώνεις ή αν είσαι ευπρόσδεκτος.

Όταν το στούντιο στέλνει ανακοίνωση μπορεί να περιορίσει τη λίστα, για παράδειγμα σε μέλη που δεν έχουν έρθει για καιρό. Είναι φίλτρο στο ποιος λαμβάνει ένα μήνυμα, που εφαρμόζει άνθρωπος και μετά πατά αποστολή. Δεν αλλάζει τίποτα στον λογαριασμό σου και δεν έχει καμία συνέπεια πέρα από το αν θα φτάσει ένα μήνυμα.`,
  },
  {
    title: "Ηλικία",
    body: `Οι λογαριασμοί είναι για άτομα ${AGE} ετών και άνω. Η σελίδα ζητά ημερομηνία γέννησης αν θέλεις να τη δώσεις και δεν δέχεται ημερομηνία που σε κάνει μικρότερο από ${AGE}.

Το στούντιο δεν κρατά εν γνώσει του στοιχεία παιδιών. Αν πιστεύεις ότι εγγράφηκε παιδί, γράψε στο ${MAIL} και θα αφαιρεθεί.`,
  },
  {
    title: "Πώς προστατεύονται τα στοιχεία σου",
    body: `Οι κωδικοί δεν αποθηκεύονται ποτέ. Αποθηκεύεται μια τιμή που παράγεται από τον κωδικό σου με μονόδρομη συνάρτηση σχεδιασμένη να είναι αργή σε επίθεση, και δεν μπορεί να αντιστραφεί. Κανείς στο στούντιο δεν μπορεί να τον διαβάσει ή να σου πει ποιος είναι.

Όλη η σελίδα σερβίρεται μέσω κρυπτογραφημένης σύνδεσης. Οι κωδικοί επιβεβαίωσης αποθηκεύονται με τον ίδιο τρόπο όπως οι κωδικοί πρόσβασης, ως παραγόμενη τιμή και όχι ο ίδιος ο κωδικός.

Μέσα στο στούντιο η πρόσβαση είναι σκόπιμα χωρισμένη: όσοι δουλεύουν στην υποδοχή βλέπουν ό,τι χρειάζονται για να σε εξυπηρετήσουν και τίποτα περισσότερο, και τα οικονομικά στοιχεία του στούντιο δεν είναι μέρος αυτού. Οι οθόνες του προσωπικού σε χώρους όπου περνά κοινό ζητούν δικό τους κωδικό και κλειδώνουν μόνες τους όταν μένουν αφύλακτες.

Κανένα σύστημα δεν είναι τέλειο. Αν κάτι πάει στραβά και είναι πιθανό να σε θέσει σε κίνδυνο, το στούντιο θα ενημερώσει εσένα και τον Επίτροπο, όπως απαιτεί ο νόμος.`,
  },
  {
    title: "Cookies",
    body: `Η σελίδα θέτει τρία cookies και αποθηκεύει μία προτίμηση στη συσκευή σου. Κανένα δεν είναι για διαφήμιση ή παρακολούθηση, και δεν υπάρχουν στατιστικά κανενός είδους.

Η σελίδα για τα cookies τα αναφέρει ένα προς ένα: τι κάνει το καθένα, πόσο διαρκεί, και πώς το αφαιρείς.`,
  },
  {
    title: "Αλλαγές σε αυτό το κείμενο",
    body: `Αν το στούντιο αλλάξει τον τρόπο που χρησιμοποιεί τα στοιχεία σου, αλλάζει και αυτή η σελίδα, και μαζί η ημερομηνία παρακάτω. Όπου η αλλαγή σε αφορά, θα το μάθεις και δεν θα αφεθεί να το προσέξεις μόνος.

Τελευταία ενημέρωση: Νοέμβριος 2026.`,
  },
];

/**
 * Russian privacy notice. Each Russian document sits after its Greek twin, is
 * translated from the English (not the Greek) section for section, and opens
 * with a note that it is a translation of the English, so its facts must
 * always track the English.
 */
const PRIVACY_RU: LegalSection[] = [
  {
    title: "О переводе",
    body: `Этот текст — перевод английской версии, сделанный для вашего удобства, и мы старались передать её точно. Если вы заметите расхождение, напишите нам на ${MAIL}, и мы исправим перевод. Любое неясное или расходящееся место толкуется в вашу пользу, и ничто в этом переводе не ограничивает ваши права как потребителя.`,
  },
  {
    title: "Кто отвечает за ваши данные",
    body: `${STUDIO.name}, студия пилатеса на реформере в ${STUDIO.parent} по адресу ${ADDRESS}, определяет, как используются описанные здесь данные. В терминах законодательства о защите данных это делает студию «контролёром данных». Студией управляет компания ${LEGAL_ENTITY} (регистрационный номер компании ${COMPANY_NO}, номер плательщика НДС ${VAT_NO}), зарегистрированная по тому же адресу.

По любому вопросу, связанному с этой страницей, в том числе по любому из перечисленных ниже прав, пишите на ${MAIL} или звоните по телефону ${TEL}.

Это уведомление описывает, что на самом деле хранят этот сайт и его система записи. Оно написано так, чтобы соответствовать тому, как работает программа, а не чтобы охватить все возможные случаи, поэтому если здесь сказано, что что-то удаляется, это действительно удаляется.`,
  },
  {
    title: "Какие данные мы храним и на каком основании",
    body: `**Чтобы открыть вам аккаунт и принимать ваши записи.** Ваше имя, адрес электронной почты, номер телефона, язык, на котором вы читаете сайт, и пароль в зашифрованном виде. Ваши записи, занятия, которые вы посетили или пропустили, ваши пакеты занятий и сроки их действия. Эти данные нужны нам, чтобы предоставить то, о чём вы просите, поэтому правовым основанием является исполнение нашего договора с вами.

**Чтобы принимать оплату.** Сумма, дата, валюта, способ оплаты, номер счёта и идентификатор платежа, который передаёт нам платёжный провайдер. Оплата картой полностью проходит через нашего платёжного провайдера: номер карты вводится в поля, которые контролирует он, и никогда не попадает ни на этот сайт, ни в студию. Хранение этих записей одновременно является частью нашего договора и юридической обязанностью по налоговому законодательству.

**Чтобы отправлять сообщения, без которых сервис не работает.** Подтверждения записи, уведомления об отмене, напоминания о занятиях, сообщение накануне вечером о следующем дне, чеки об оплате и уведомления об изменении занятия или расписания. Они неотъемлемая часть аккаунта и не отключаются, но вы сами выбираете, по каким каналам их получать: электронная почта, SMS или уведомления на телефоне. Правовое основание — наш договор с вами.

**Чтобы отправлять предложения и новости, только если вы об этом попросили.** Это отдельный, необязательный выбор, который делается при регистрации или в аккаунте, на основании вашего согласия. Вы можете отозвать его в любой момент в разделе «Мой аккаунт», и это не повлияет на служебные сообщения, указанные выше.

**Сведения о вашем здоровье, которые вы нам сообщаете.** См. раздел ниже. Это персональные данные особой категории, и мы обрабатываем их на основании вашего явного согласия.

**Ваши необязательные данные.** Фотография профиля, дата рождения, рост и вес, если вы решите их указать. Все эти поля можно оставить пустыми и пользоваться студией как обычно. Дату рождения мы храним потому, что при допуске к занятиям на реформере учитывается возраст, а не для того, чтобы поздравлять вас с днём рождения.

**Рабочие заметки студии.** Краткие заметки инструкторов и администраторов, которые нужны, чтобы безопасно проводить для вас занятия. Основание — наш законный интерес в этом; вы можете попросить показать вам эти заметки.

**Сообщения, которые вы нам отправляете.** Если вы пользуетесь формой обратной связи, мы храним ваше имя, адрес электронной почты, номер телефона (если вы его указали) и текст сообщения, чтобы вам могли ответить.

**Технические данные, необходимые для работы сайта.** На каких ваших устройствах разрешены уведомления и краткое описание браузера на каждом из них, чтобы устройство, которое перестало принимать сообщения, можно было отключить.`,
  },
  {
    title: "Сведения о вашем здоровье",
    body: `При регистрации, а также в любое время позже в своём аккаунте вы можете сообщить нам обо всём, к чему нам следует отнестись внимательно: о травме, заболевании, беременности, движении, которое причиняет боль. Администратор также может записать это за вас, если вы скажете об этом на стойке.

Это сведения о вашем здоровье, и закон требует защищать их строже, чем остальные данные. Мы храним их только потому, что вы дали на это явное согласие, и вы можете в любой момент отозвать его или стереть свой ответ. Пустое поле — тоже полноценный ответ, и оно не мешает вам записываться на любые занятия.

Кто их видит: сотрудники на стойке администратора и инструктор занятия, на которое вы записаны. На экранах студии эти сведения скрыты, пока они кому-то не понадобятся, потому что экраны находятся в помещениях, где есть другие люди. Другим клиентам они нигде не показываются и никогда не передаются за пределы студии.

Мы спрашиваем об этом, потому что пять человек на пяти реформерах — это зал, где инструктору нужно знать, за чьим плечом следить. Ничто здесь не является медицинской консультацией, и студия — не клиника: если вы не уверены, можно ли вам заниматься, спросите врача, а не нас.`,
  },
  {
    title: "Оплата картой",
    body: `Для приёма платежей по картам студия пользуется услугами специализированного платёжного провайдера. Когда вы платите, поля для данных карты на странице оплаты принадлежат этому провайдеру и отображаются во фреймах, которые он контролирует; номер карты, срок её действия и код безопасности передаются напрямую ему, никогда не отправляются на этот сайт, не хранятся на нём и не видны студии.

Мы храним запись о платеже: сумму, дату, валюту, способ оплаты, номер счёта, идентификатор платежа у провайдера и ссылку на чек, который размещён у провайдера. В этом чеке указаны последние четыре цифры карты; это запись провайдера, а не наша.

Провайдер — регулируемая платёжная организация, которая несёт собственную ответственность за часть своей деятельности и публикует собственное уведомление о конфиденциальности. Напишите на ${MAIL}, и студия сообщит, каким провайдером она пользуется и где найти это уведомление.

Если вы платите наличными или картой на стойке администратора, администратор фиксирует сумму и способ оплаты; данные карты не сохраняются ни в том, ни в другом случае.`,
  },
  {
    title: "Кто ещё обрабатывает ваши данные",
    body: `Для работы этого сервиса студия пользуется услугами нескольких компаний. Каждая получает только то, что ей необходимо, и связана договором, который разрешает ей использовать данные исключительно по указаниям студии.

**Хостинговая компания** обеспечивает работу сайта и его базы данных в дата-центре во Франкфурте (Германия).

**Платёжный провайдер** принимает оплату картами, как описано выше.

**Компания по рассылке SMS, расположенная на Кипре,** отправляет текстовые сообщения. Она получает номер телефона и текст сообщения, и только тогда, когда вам действительно отправляется SMS.

**Почтовый провайдер** обслуживает почтовый ящик студии, поэтому через него проходит любое письмо, которое мы вам отправляем.

**Сервис резервного копирования** хранит внешнюю копию базы данных студии, чтобы записи можно было восстановить, если основная копия когда-либо будет утрачена. Эта копия содержит всё, что есть в базе данных, включая указанные выше сведения о здоровье.

Стоит назвать ещё две вещи, которые делает ваш браузер. Шрифты на этом сайте загружаются из сервиса шрифтов, а значит, этот сервис видит сетевой адрес, который использует ваше устройство; если студия предпочтёт, сайт можно перевести на собственную раздачу шрифтов. А уведомления доставляются через push-сервис, которым пользуется ваш браузер; он зависит от вашего устройства, и студия не имеет с ним никаких отношений и не может на него влиять.

Мы не пользуемся никакими сервисами аналитики, рекламы или отслеживания. Ничто на этом сайте никому не сообщает о ваших действиях, и на нём нет ни одного стороннего скрипта, кроме скрипта платёжного провайдера, который загружается только на странице оплаты.

**Если вам нужны названия, спросите.** Напишите на ${MAIL}, и студия сообщит, какие именно это компании. Они описаны по тому, что делают, а не по названию, чтобы эта страница не устаревала при каждой смене поставщика, а не для того, чтобы скрыть их от вас.

Мы не продаём ваши данные и никогда не будем этого делать.`,
  },
  {
    title: "Где хранятся данные и покидают ли они Европу",
    body: `База данных находится во Франкфурте (Германия), на территории Европейского союза.

Платёжный провайдер и почтовый провайдер работают как в пределах Европейской экономической зоны, так и за её пределами, и данные, которые к ним попадают, могут передаваться в страны, законодательство которых отличается от нашего. В таких случаях они опираются на гарантии, которые предусматривает для этого европейское право: либо на решение Европейской комиссии о том, что страна обеспечивает достаточный уровень защиты данных, либо на стандартные договорные условия, утверждённые Комиссией.

Внешняя резервная копия базы данных хранится у сервиса, который работает за пределами Европейской экономической зоны, с теми же гарантиями.`,
  },
  {
    title: "Как долго мы храним данные",
    body: `**Ваш аккаунт — пока вы не попросите его удалить.** Мы не удаляем аккаунты за неактивность. Тот, кто занимался здесь два года назад и вернулся, должен найти свою историю там, где её оставил.

**Аккаунт, в котором так и не был подтверждён адрес электронной почты, — ${UNVERIFIED_DAYS} дн.** Если вы начали регистрацию и так и не ввели код, вся запись автоматически удаляется через ${UNVERIFIED_DAYS} дн., если с ней не связан платёж или запись на занятие. Студия не должна хранить адрес человека, с которым у неё нет никаких отношений.

**Коды подтверждения — 24 часа после истечения их срока.** Затем запись о коде удаляется. Сам код мы никогда не храним — только производное от него значение, из которого код восстановить невозможно.

**Платёжные записи — шесть лет с конца года, к которому они относятся.** Этого требует налоговое и корпоративное законодательство Кипра, и это единственная категория данных, которую мы не можем удалить по запросу, пока этот срок не истёк. Именно поэтому при удалении данных клиента исчезают сведения о том, кем он был, но остаётся факт, что в определённую дату был совершён платёж на определённую сумму.

**Всё остальное — пока вы не попросите удалить.** Записи на занятия, посещения, история занятий и отправленные вам сообщения хранятся в аккаунте, пока вы не попросите их удалить; после этого с ними поступают так, как описано в следующем разделе.

Об одном скажем прямо: кроме двух названных выше автоматических очисток, здесь ничего не удаляется само по истечении времени. Студия удаляет данные по запросу и делает это как следует.`,
  },
  {
    title: "Что на самом деле происходит при удалении данных",
    body: `Вы можете попросить студию удалить ваши данные, и она это сделает. Вот что именно происходит, потому что за фразой «мы удалим ваши данные» обычно что-то скрывается.

**Удаляется полностью:** ваше имя, которое заменяется на «Erased member» («удалённый клиент»); ваш адрес электронной почты, который заменяется условным адресом в домене, не способном принимать почту; ваш номер телефона; дата рождения, рост и вес; всё, что вы сообщили нам о своём здоровье; ваш уровень и опыт в пилатесе; рабочие заметки студии о вас; фотография профиля; все устройства, зарегистрированные для уведомлений; любой незавершённый код подтверждения; и все сообщения, которые вы отправили нам через форму обратной связи.

Ваш пароль заменяется паролем, которого никто не знает, поэтому войти в аккаунт больше невозможно. Согласие на маркетинговые рассылки, уведомления по электронной почте и SMS отключаются.

**Сохраняется, и почему:** сами платежи, а также связанные с ними записи на занятия и посещения. Не потому, что их удобно хранить, а потому, что выручка студии, например, за прошлый март — это сумма этих строк, и их удаление изменило бы уже поданную отчётность. Остаётся лишь запись о том, что в определённую дату был совершён платёж на определённую сумму, без имени. Также сохраняется дата, когда вы дали согласие на то, чтобы с вами связывались: это доказательство, которое может понадобиться студии именно в том случае, если вы впоследствии оспорите её действия в отношении вас.

**Не отменяются автоматически:** занятия, на которые вы уже записаны. Студия сообщит вам, сколько их, чтобы вы могли решить, что с ними делать.

Если у вас есть записи на занятия или оплаченный остаток занятий, сначала сообщите нам, что с ними сделать: удаление необратимо.`,
  },
  {
    title: "Ваши права",
    body: `Вы вправе:

**Получить копию данных**, которые хранит студия, и оставить её себе.
**Исправить неточности.** Большую часть данных вы можете исправить сами в разделе «Мой аккаунт», а остальное администратор исправит при вас.
**Потребовать удаления данных**, как описано выше.
**Временно ограничить обработку**, если вы что-то оспариваете и хотите, чтобы данные были заморожены, а не удалены.
**Возразить** против обработки данных, основанной на законном интересе студии, то есть против её рабочих заметок.
**Получить данные в переносимом формате** — те, которые вы нам предоставили и которые мы обрабатываем на основании договора или вашего согласия.
**Отозвать согласие** в любой момент. Предложения и новости отключаются в разделе «Мой аккаунт» одним нажатием. Сведения о здоровье можно стереть там же. Отзыв согласия не отменяет того, что было сделано, пока оно действовало.

Чтобы воспользоваться этими правами, напишите на ${MAIL}. Студия ответит в течение одного месяца, а если ей понадобится больше времени, сообщит об этом и объяснит причину. Это бесплатно.

Если ответ студии вас не устроит, вы можете подать жалобу в Управление Уполномоченного по защите персональных данных Республики Кипр: commissioner@dataprotection.gov.cy или www.dataprotection.gov.cy. Вы можете обратиться туда, не обращаясь сначала к нам, хотя мы бы предпочли получить возможность всё исправить.`,
  },
  {
    title: "Решения о вас и выбор получателей рассылок",
    body: `Ничто на этом сайте не принимает в отношении вас автоматизированных решений, влекущих юридические или аналогично значимые последствия. Никакой алгоритм не решает, можете ли вы записаться, сколько вы платите и рады ли вам здесь.

Отправляя объявление, студия может сузить список получателей, например до клиентов, которые давно не приходили. Это фильтр, определяющий, кто получит сообщение; его применяет человек, который затем нажимает «отправить». Он ничего не меняет в вашем аккаунте и не имеет никаких последствий, кроме того, придёт ли вам одно сообщение.`,
  },
  {
    title: "Возраст",
    body: `Аккаунты предназначены для лиц не младше ${AGE} лет. Сайт запрашивает дату рождения, если вы решите её указать, и не примет дату, по которой вам меньше ${AGE} лет.

Студия сознательно не хранит данные детей. Если вы считаете, что зарегистрировался ребёнок, напишите на ${MAIL}, и его данные будут удалены.`,
  },
  {
    title: "Как защищены ваши данные",
    body: `Пароли никогда не хранятся. Хранится значение, полученное из вашего пароля с помощью односторонней функции, которая намеренно сделана медленной, чтобы её было трудно взломать; восстановить из этого значения пароль невозможно. Никто в студии не может его прочитать или сказать вам, какой у вас пароль.

Весь сайт работает через зашифрованное соединение. Коды подтверждения хранятся так же, как пароли: в виде производного значения, а не самого кода.

Внутри студии доступ намеренно разграничен: сотрудники на стойке администратора видят то, что им нужно, чтобы вас обслужить, и не более того, а финансовые показатели студии в это не входят. Экраны персонала в общественных зонах здания запрашивают собственный пароль и блокируются, если их оставить без присмотра.

Ни одна система не идеальна. Если что-то всё же пойдёт не так и это может создать для вас риск, студия сообщит об этом вам и Уполномоченному, как того требует закон.`,
  },
  {
    title: "Cookie-файлы",
    body: `Этот сайт устанавливает три cookie-файла и сохраняет на вашем устройстве одну настройку. Ни один из них не используется для рекламы или отслеживания, и никакой аналитики нет.

На странице о cookie-файлах описан каждый из них: для чего он нужен, как долго хранится и как его удалить.`,
  },
  {
    title: "Изменения настоящего уведомления",
    body: `Если студия изменит то, как она использует ваши данные, эта страница изменится вместе с этим, как и дата ниже. Если изменение для вас существенно, вам сообщат о нём, а не оставят замечать самостоятельно.

Последнее обновление: ноябрь 2026.`,
  },
];

const TERMS_EL: LegalSection[] = [
  {
    title: "Με ποιον συναλλάσσεσαι",
    body: `Οι όροι αυτοί είναι η συμφωνία μεταξύ εσού και του ${STUDIO.name}, του στούντιο reformer pilates μέσα στο ${STUDIO.parent} στη διεύθυνση ${ADDRESS}, που λειτουργεί από την ${LEGAL_ENTITY} (αριθμός εγγραφής εταιρείας ${COMPANY_NO}, ΦΠΑ ${VAT_NO}).

Επικοινωνία: ${MAIL}, ${TEL}.

Δημιουργώντας λογαριασμό, κλείνοντας μάθημα ή αγοράζοντας πακέτο, συμφωνείς με ό,τι υπάρχει σε αυτή τη σελίδα. Διάβασέ την: τα σημεία για την ακύρωση και για την υγεία σου είναι εκείνα που οι περισσότεροι εύχονται να είχαν διαβάσει.`,
  },
  {
    title: "Ο λογαριασμός σου",
    body: `Χρειάζεσαι λογαριασμό για να κλείσεις μάθημα. Δώσε αληθινό όνομα, αληθινό email και αληθινό τηλέφωνο: το στούντιο χρησιμοποιεί και τα τρία για να σε βρει όταν αλλάζει ένα μάθημα.

Επιβεβαιώνεις το email σου με εξαψήφιο κωδικό. Μέχρι τότε ο λογαριασμός δεν κλείνει και δεν πληρώνει, και αν δεν επιβεβαιωθεί ποτέ διαγράφεται μετά από ${UNVERIFIED_DAYS} ημέρες.

Ένα τηλέφωνο ανήκει σε έναν λογαριασμό. Δύο άνθρωποι δεν μπορούν να μοιράζονται ένα, γιατί δύο άνθρωποι με ένα νούμερο είναι δύο μέλη που η υποδοχή δεν ξεχωρίζει στο τηλέφωνο.

Οι λογαριασμοί είναι για άτομα ${AGE} ετών και άνω. Κράτα τον κωδικό σου για τον εαυτό σου· ό,τι γίνεται από τον λογαριασμό σου θεωρείται ότι το έκανες εσύ.`,
  },
  {
    title: "Τι αγοράζεις",
    body: `Αγοράζεις συνεδρίες, όχι χρόνο. Ένα πακέτο είναι ένας αριθμός συνεδριών με ημερομηνία μέχρι την οποία πρέπει να χρησιμοποιηθούν, και οι δύο αριθμοί φαίνονται πριν πληρώσεις και ξανά στον λογαριασμό σου.

Το ημερήσιο πάσο είναι μία συνεδρία. Ένα μηνιαίο πακέτο ή πακέτο διάρκειας είναι ένας αριθμός συνεδριών την εβδομάδα για εκείνη τη διάρκεια. Το Unlimited σημαίνει όσα μαθήματα θέλεις μέσα στη διάρκεια, με όριο ένα μάθημα την ημέρα· το ημερήσιο όριο είναι μέρος του προϊόντος και όχι παράλειψη.

Οι συνεδρίες ανήκουν στον λογαριασμό που τις αγόρασε. Δεν χαρίζονται, δεν πωλούνται, δεν μοιράζονται και δεν μεταφέρονται σε άλλον, και η Δυάδα είναι η εξαίρεση που επιβεβαιώνει τον κανόνα: είναι μία συνεδρία που δέχεται δύο άτομα, κλεισμένη από το μέλος που την έχει.

Οι Ατομικές και οι Δυάδες αγοράζουν μία ώρα με εκπαιδευτή και δεν ξοδεύονται σε ομαδικό μάθημα. Οι ομαδικές συνεδρίες δεν ξοδεύονται σε ραντεβού. Τιμολογούνται διαφορετικά και δεν είναι εναλλάξιμες προς καμία κατεύθυνση.`,
  },
  {
    title: "Κλείνοντας μάθημα",
    body: `Στην αίθουσα υπάρχουν ${PLACES} reformer, οπότε ένα μάθημα έχει ${PLACES} θέσεις και ένα πλήρες μάθημα είναι πράγματι πλήρες. Κάθε μάθημα είναι ${MINUTES} λεπτά στο στρώμα μέσα σε μια ώρα· η υπόλοιπη ώρα είναι η αλλαγή.

Μία συνεδρία αγοράζει μία θέση σε ένα μάθημα. Μπορείς να κλείσεις όσο μακριά φτάνει το πρόγραμμα, και μπορείς να κλείσεις την ίδια ώρα για σειρά εβδομάδων με μία κίνηση.

Οι Ατομικές και οι Δυάδες γίνονται το μεσημέρι τις εργάσιμες και πρέπει να κλείνονται μέχρι το τέλος της προηγούμενης ημέρας, ώστε να κανονιστεί εκπαιδευτής. Η Δυάδα κλείνεται από τον έναν από τους δύο, που δίνει το όνομα του άλλου.

Αν κλείσεις μάθημα που οι συνεδρίες σου δεν καλύπτουν, ή αν το πακέτο σου λήγει πριν το μάθημα, η σελίδα θα σου πει ποιο και γιατί, αντί να δεχτεί την κράτηση και να το λύσει μετά.`,
  },
  {
    title: "Ακύρωση, και απουσία",
    body: `**Πάνω από ${HOURS} ώρες πριν το μάθημα: ακυρώνεις και η συνεδρία επιστρέφει.** Ένα πάτημα, χωρίς εξηγήσεις, και γυρίζει στο πακέτο από το οποίο βγήκε με την αρχική του ημερομηνία λήξης.

**Λιγότερο από ${HOURS} ώρες πριν: μπορείς και πάλι να ακυρώσεις, και η συνεδρία δεν επιστρέφεται.** Η σελίδα θα το πει καθαρά και θα σου ζητήσει να επιβεβαιώσεις πριν κάνει οτιδήποτε. Ακύρωσε ωστόσο: ελευθερώνει τη θέση σου για κάποιον άλλον και λέει στον εκπαιδευτή να μη σε περιμένει.

**Το να μην έρθεις καθόλου** αντιμετωπίζεται όπως η καθυστερημένη ακύρωση, με τη διαφορά ότι κανείς δεν παίρνει τη θέση σου.

**Οι Ατομικές και οι Δυάδες** κλείνουν σε δωρεάν ακύρωση στο τέλος της προηγούμενης ημέρας, για τον ίδιο λόγο που κλείνουν και σε κράτηση: ένας εκπαιδευτής έχει ήδη κληθεί να έρθει και εκείνη η ώρα δουλεύεται έτσι κι αλλιώς. Μετά από αυτό μπορείς ακόμη να ακυρώσεις, αλλά η συνεδρία δεν επιστρέφεται.

**Η υποδοχή μπορεί να παρακάμψει όλα αυτά.** Αν τηλεφωνήσεις με καλό λόγο, αποφασίζει το άτομο με το οποίο μιλάς, και μπορεί να επιστρέψει τη συνεδρία ό,τι κι αν λέει το ρολόι. Είναι σκόπιμο: ένας κανόνας που δεν λυγίζει από κάποιον που ξέρει την κατάσταση είναι κανόνας που τιμωρεί τους λάθος ανθρώπους.`,
  },
  {
    title: "Πληρωμή",
    body: `Μπορείς να πληρώσεις με κάρτα σε αυτή τη σελίδα, ή με μετρητά ή κάρτα στην υποδοχή. Οι τιμές είναι σε ευρώ και περιλαμβάνουν ΦΠΑ όπου εφαρμόζεται.

Οι πληρωμές με κάρτα στη σελίδα γίνονται μέσω εξειδικευμένου παρόχου πληρωμών, και το στούντιο δεν βλέπει ούτε κρατά τον αριθμό της κάρτας σου. Σε κάθε διαδικτυακή πληρωμή με κάρτα επισυνάπτεται τιμολόγιο ΦΠΑ στην επιβεβαίωση.

Οι συνεδρίες προστίθενται στο υπόλοιπό σου μόλις επιβεβαιωθεί η πληρωμή. Αν χρεωθείς και δεν εμφανιστούν, πες το στο στούντιο και θα διορθωθεί· η εγγραφή του παρόχου πληρωμών είναι αυτή που κρίνει κάθε διαφωνία για το αν κινήθηκαν χρήματα.`,
  },
  {
    title: "Επιστροφές και λήξη",
    body: `Οι μη χρησιμοποιημένες συνεδρίες δεν επιστρέφονται σε χρήμα, και δεν παρατείνονται επειδή έλειπες, ήσουν άρρωστος ή απασχολημένος. Η ημερομηνία λήξης είναι μέρος αυτού που αγόρασες, και φαίνεται πριν πληρώσεις και στον λογαριασμό σου μετά.

Αυτός είναι ο κανόνας, και η υποδοχή μπορεί να ρωτηθεί. Ασθένεια, τραυματισμός, εγκυμοσύνη και αλλαγή στις συνθήκες σου είναι ακριβώς οι περιπτώσεις που το στούντιο προτιμά να ακούσει παρά να επιβάλει μια ημερομηνία. Ρώτα.

Αν το στούντιο ακυρώσει μάθημα που είχες κλείσει, η συνεδρία γυρίζει στο υπόλοιπό σου και δεν έχασες τίποτα. Αν το στούντιο κλείσει για διάστημα αρκετό να απειλήσει τη λήξη σου, θα μετακινήσει την ημερομηνία αντί να την αφήσει να τρέξει.

Η αγορά μέσω διαδικτύου είναι σύμβαση εξ αποστάσεως, και η νομοθεσία για τους καταναλωτές σου δίνει δεκατέσσερις ημέρες να αλλάξεις γνώμη. Το δικαίωμα δεν επεκτείνεται σε συνεδρίες που έχεις ήδη χρησιμοποιήσει, και ένα μάθημα στο οποίο ήρθες έχει παρασχεθεί. Αν αγόρασες πακέτο και δεν χρησιμοποίησες τίποτα, γράψε μέσα σε δεκατέσσερις ημέρες και το στούντιο θα το επιστρέψει.`,
  },
  {
    title: "Δωρεάν και προωθητικές συνεδρίες",
    body: `Κατά καιρούς το στούντιο δίνει μια συνεδρία δωρεάν, όπως μια προσφορά υποδοχής για νέα μέλη. Μια δωρεάν συνεδρία ακολουθεί τους ίδιους κανόνες με κάθε άλλη, και μερικούς δικούς της.

Δίνεται σε λογαριασμούς που πληρούν τις προϋποθέσεις μέσα στις ημερομηνίες της προσφοράς, μία ανά λογαριασμό, και το αν πληροίς τις προϋποθέσεις κρίνεται από το πότε δημιουργήθηκε ο λογαριασμός σου και όχι από κάτι που κάνεις μετά.

Ξοδεύεται μόνο σε μαθήματα μέσα στο δικό της παράθυρο, που σου δείχνεται όταν δίνεται η συνεδρία και συνήθως είναι μικρότερο από ένα αγορασμένο πακέτο. Λήγει στην ημερομηνία που φαίνεται και δεν παρατείνεται.

Μια δωρεάν συνεδρία δεν επιστρέφεται σε χρήμα, δεν μεταφέρεται και δεν μοιράζεται, και το στούντιο μπορεί να αλλάξει ή να αποσύρει μια προσφορά οποτεδήποτε. Οι συνεδρίες που έχουν ήδη δοθεί τηρούνται με τους όρους με τους οποίους δόθηκαν.`,
  },
  {
    title: "Η υγεία σου, και η ειλικρίνεια μαζί μας",
    body: `Το reformer pilates είναι άσκηση σε μηχάνημα με ελατήρια. Κλείνοντας μάθημα βεβαιώνεις ότι είσαι αρκετά καλά για να συμμετέχεις και ότι δεν γνωρίζεις κάτι που το καθιστά μη ασφαλές για σένα.

Πες στο στούντιο ό,τι πρέπει να προσέχει: τραυματισμό, μια κατάσταση, πρόσφατη επέμβαση, εγκυμοσύνη, μια κίνηση που πονά. Υπάρχει πεδίο για αυτό στην εγγραφή και στον λογαριασμό σου, και η υποδοχή θα το γράψει αν προτιμάς να το πεις. Μένει μεταξύ εσού, της υποδοχής και του εκπαιδευτή του μαθήματός σου.

Αν κάτι αλλάξει, πες μας. Ένας εκπαιδευτής που δεν ξέρει για τον ώμο σου δεν μπορεί να τον προσέξει.

Οι εκπαιδευτές του στούντιο είναι καταρτισμένοι να διδάσκουν pilates και δεν είναι γιατροί. Τίποτα από όσα λένε εκείνοι ή αυτή η σελίδα δεν είναι ιατρική συμβουλή. Αν δεν είσαι σίγουρος αν πρέπει να ασκείσαι, ρώτησε πρώτα γιατρό, και σε παρακαλούμε κάνε αυτό αντί να μας ζητήσεις να αποφασίσουμε εμείς.

Ένας εκπαιδευτής μπορεί να αλλάξει μια άσκηση για σένα, να σου ζητήσει να μην την κάνεις, ή να σου ζητήσει να καθίσεις έξω από ένα μάθημα, αν κατά την κρίση του δεν είναι ασφαλές. Η κρίση αυτή είναι δική του και είναι τελική μέσα στην αίθουσα.`,
  },
  {
    title: "Μέσα στο στούντιο",
    body: `Έλα λίγα λεπτά πιο νωρίς. Ένα μάθημα ${MINUTES} λεπτών που ξεκινά στην ώρα δεν μπορεί να περιμένει, και ένας εκπαιδευτής δεν μπορεί με ασφάλεια να ρυθμίσει κάποιον σε reformer ενώ το μάθημα κινείται· αν έρθεις αφού ξεκινήσει, μπορεί να σου ζητηθεί να καθίσεις έξω, και αυτό μετράει ως μάθημα.

Οι αντιολισθητικές κάλτσες είναι υποχρεωτικές, για υγιεινή και γιατί τα γυμνά πόδια γλιστρούν σε κινούμενο φορείο.

Φρόντισε τον εξοπλισμό, τους εκπαιδευτές και τους άλλους τέσσερις ανθρώπους στην αίθουσα. Το στούντιο μπορεί να ζητήσει από κάποιον να αποχωρήσει, και σε σοβαρή περίπτωση να κλείσει τον λογαριασμό του, αν η συμπεριφορά του κάνει την αίθουσα μη ασφαλή ή δυσάρεστη για άλλους. Σε αυτή την περίπτωση οι συνεδρίες δεν επιστρέφονται.`,
  },
  {
    title: "Αλλαγές από το στούντιο",
    body: `Το πρόγραμμα, οι εκπαιδευτές και οι τιμές μπορούν να αλλάξουν. Όπου μια αλλαγή επηρεάζει μάθημα που έχεις κλείσει θα ενημερωθείς, και όπου ένα μάθημα ακυρώνεται η συνεδρία επιστρέφει.

Ο εκπαιδευτής που αναφέρεται σε ένα μάθημα είναι η πρόθεση του στούντιο και όχι υπόσχεση: τα προγράμματα αλλάζουν, οι άνθρωποι αρρωσταίνουν, και το μάθημα γίνεται. Ενημερώνεσαι όταν αλλάζει το όνομα σε μάθημα που έχεις.

Οι τιμές αλλάζουν μόνο προς το μέλλον. Ένα πακέτο που αγόρασες κρατά την τιμή και τους όρους με τους οποίους το αγόρασες.

Το στούντιο κλείνει τις επίσημες αργίες και μπορεί να κλείσει για συντήρηση ή για λόγους πέρα από τον έλεγχό του. Τα κλεισίματα ανακοινώνονται, οι κρατήσεις μέσα σε αυτά ακυρώνονται και οι συνεδρίες επιστρέφονται.`,
  },
  {
    title: "Αν κάτι πάει στραβά",
    body: `Το στούντιο είναι υπεύθυνο να παρέχει τα μαθήματα που πλήρωσες με εύλογη δεξιότητα και επιμέλεια, και να συντηρεί σωστά τον εξοπλισμό του.

Δεν είναι υπεύθυνο για τραυματισμό που προκύπτει από την αγνόηση οδηγίας εκπαιδευτή, από τη χρήση εξοπλισμού με τρόπο που σου είπαν να μην κάνεις, ή από κατάσταση που επέλεξες να μη μας πεις. Δεν είναι υπεύθυνο για αντικείμενα που αφήνονται στο στούντιο.

Τίποτα σε αυτούς τους όρους δεν περιορίζει ό,τι δεν μπορεί νόμιμα να περιοριστεί, συμπεριλαμβανομένης της ευθύνης για θάνατο ή σωματική βλάβη από αμέλεια, ή για απάτη. Τα δικαιώματά σου ως καταναλωτή κατά το κυπριακό και το ευρωπαϊκό δίκαιο ισχύουν ό,τι κι αν λέει αυτή η σελίδα, και όπου κάτι εδώ συγκρούεται με αυτά, υπερισχύουν εκείνα.`,
  },
  {
    title: "Παράπονα, και το εφαρμοστέο δίκαιο",
    body: `Αν κάτι δεν είναι σωστό, πες το πρώτα στο στούντιο: ${MAIL}, ή ${TEL}, ή στο άτομο στην υποδοχή. Τα περισσότερα λύνονται σε μια συζήτηση.

Οι όροι αυτοί διέπονται από το δίκαιο της Κυπριακής Δημοκρατίας, και τα κυπριακά δικαστήρια έχουν δικαιοδοσία. Ως καταναλωτής διατηρείς το δικαίωμα να προσφύγεις στον τόπο κατοικίας σου.

Το στούντιο μπορεί να αλλάξει αυτούς τους όρους. Αν μια αλλαγή σε αφορά, θα ενημερωθείς και δεν θα αφεθεί να την ανακαλύψεις μόνος. Η συνέχιση της χρήσης του λογαριασμού σου μετά από αλλαγή σημαίνει αποδοχή της έκδοσης που βρίσκεται εδώ.

Τελευταία ενημέρωση: Νοέμβριος 2026.`,
  },
];

/** Russian terms, translated from TERMS_EN (see the note in its first section). */
const TERMS_RU: LegalSection[] = [
  {
    title: "О переводе",
    body: `Этот текст — перевод английской версии, сделанный для вашего удобства, и мы старались передать её точно. Если вы заметите расхождение, напишите нам на ${MAIL}, и мы исправим перевод. Любое неясное или расходящееся место толкуется в вашу пользу, и ничто в этом переводе не ограничивает ваши права как потребителя.`,
  },
  {
    title: "С кем вы заключаете договор",
    body: `Настоящие условия — это соглашение между вами и ${STUDIO.name}, студией пилатеса на реформере в ${STUDIO.parent} по адресу ${ADDRESS}, которой управляет компания ${LEGAL_ENTITY} (регистрационный номер компании ${COMPANY_NO}, номер плательщика НДС ${VAT_NO}).

Контакты: ${MAIL}, ${TEL}.

Создавая аккаунт, записываясь на занятие или покупая пакет, вы соглашаетесь с тем, что изложено на этой странице. Пожалуйста, прочитайте её: чаще всего люди жалеют, что не прочитали именно разделы об отмене и о здоровье.`,
  },
  {
    title: "Ваш аккаунт",
    body: `Чтобы записываться на занятия, нужен аккаунт. Указывайте настоящее имя, настоящий адрес электронной почты и настоящий номер телефона: студия использует все три, чтобы связаться с вами, если занятие переносится.

Вы подтверждаете адрес электронной почты шестизначным кодом. До подтверждения с аккаунта нельзя записываться на занятия и оплачивать их, а если адрес так и не будет подтверждён, аккаунт удаляется через ${UNVERIFIED_DAYS} дн.

Один номер телефона — один аккаунт. Два человека не могут пользоваться одним номером, потому что двух людей с одним номером администратор не сможет различить по телефону.

Аккаунты предназначены для лиц не младше ${AGE} лет. Никому не сообщайте свой пароль: всё, что сделано из вашего аккаунта, считается сделанным вами.`,
  },
  {
    title: "Что вы покупаете",
    body: `Вы покупаете занятия, а не время. Пакет — это определённое количество занятий и дата, до которой их нужно использовать; и то и другое показывается до оплаты и затем в вашем аккаунте.

Разовое посещение — это одно занятие. Месячный пакет или пакет на срок — это определённое количество занятий в неделю в течение этого срока. Тариф «Безлимит» означает сколько угодно занятий в течение срока, но не более одного занятия в день; это дневное ограничение — часть продукта, а не недосмотр.

Занятия принадлежат аккаунту, с которого они куплены. Их нельзя подарить, продать, разделить с кем-то или передать другому человеку, и дуэт — исключение, которое подтверждает правило: это одно занятие, на которое допускаются два человека, и записывается на него клиент, которому оно принадлежит.

Персональное занятие и дуэт дают час с инструктором, и их нельзя использовать для записи на групповое занятие. Групповые занятия нельзя использовать для записи на персональное занятие или дуэт. Они стоят по-разному и не взаимозаменяемы ни в одну сторону.`,
  },
  {
    title: "Запись на занятие",
    body: `Реформеров в зале — ${PLACES}, поэтому и мест на занятии — ${PLACES}, и если занятие заполнено, оно действительно заполнено. Каждое занятие длится ${MINUTES} мин в рамках часового слота; остаток часа уходит на смену групп.

Одно занятие с баланса — это одно место на одном занятии в расписании. Записываться можно на любую дату, до которой открыто расписание, а на одно и то же время можно записаться сразу на несколько недель вперёд.

Персональные занятия и дуэты проходят в середине дня по будням, и записаться на них нужно до конца предыдущего дня, чтобы студия успела пригласить инструктора. На дуэт записывается один из двух участников и указывает имя второго.

Если вы записываетесь на занятие, для которого на вашем балансе нет подходящих занятий, или срок действия вашего пакета истекает до даты занятия, сайт сообщит, что именно не так и почему, а не примет запись, чтобы разбираться потом.`,
  },
  {
    title: "Отмена и пропуск занятия",
    body: `**Более чем за ${HOURS} ч до начала занятия: отмените, и занятие вернётся.** Одно нажатие, без объяснения причин, и занятие возвращается в тот пакет, из которого было списано, с исходным сроком действия этого пакета.

**Менее чем за ${HOURS} ч: отменить по-прежнему можно, но занятие не возвращается.** Сайт прямо скажет об этом и попросит подтвердить, прежде чем что-либо сделать. Пожалуйста, всё равно отменяйте запись: так ваше место освободится для кого-то другого, а инструктор будет знать, что вас не нужно ждать.

**Неявка** приравнивается к поздней отмене, с той разницей, что ваше место никому не достаётся.

**Персональные занятия и дуэты** можно бесплатно отменить только до конца предыдущего дня, по той же причине, по которой до этого момента закрывается запись: инструктор уже приглашён, и этот час будет отработан в любом случае. После этого отменить запись всё ещё можно, но занятие не вернётся.

**Администратор может сделать исключение из любого из этих правил.** Если вы позвоните в студию по уважительной причине, решение принимает тот, с кем вы говорите, и он может вернуть занятие независимо от того, сколько времени осталось до начала. Это сделано намеренно: правило, которое не может смягчить человек, знающий ситуацию, наказывает не тех людей.`,
  },
  {
    title: "Оплата",
    body: `Оплатить можно картой на этом сайте либо наличными или картой на стойке администратора. Цены указаны в евро и включают НДС, если он применяется.

Платежи картой на сайте принимает специализированный платёжный провайдер, и студия никогда не видит и не хранит номер вашей карты. К подтверждению каждого онлайн-платежа картой прилагается счёт с НДС.

Занятия зачисляются на ваш баланс сразу после подтверждения платежа. Если деньги списаны, а занятия не появились, сообщите об этом в студию, и ошибка будет исправлена; в любом споре о том, прошёл ли платёж, решающей является запись платёжного провайдера.`,
  },
  {
    title: "Возвраты и срок действия",
    body: `Неиспользованные занятия не возмещаются деньгами и не продлеваются из-за того, что вы были в отъезде, болели или были заняты. Срок действия — часть того, что вы купили; он показывается до оплаты и затем в вашем аккаунте.

Таково правило, но вы можете обратиться к администратору. Болезнь, травма, беременность и изменение жизненных обстоятельств — именно те случаи, о которых студия предпочитает узнать, а не настаивать на сроке. Спросите.

Если студия отменяет занятие, на которое вы были записаны, занятие возвращается на ваш баланс, и вы ничего не теряете. Если студия закрывается на срок, достаточный, чтобы поставить под угрозу срок действия вашего пакета, она перенесёт дату, а не позволит ей истечь.

Покупка онлайн — это договор, заключённый дистанционно, и законодательство о защите прав потребителей даёт вам четырнадцать дней, чтобы передумать. Это право не распространяется на уже использованные занятия: занятие, которое вы посетили, считается оказанной услугой. Если вы купили пакет и не использовали из него ни одного занятия, напишите в течение четырнадцати дней, и студия вернёт за него деньги.`,
  },
  {
    title: "Бесплатные и промо-занятия",
    body: `Время от времени студия дарит бесплатное занятие, например в рамках предложения к открытию для новых клиентов. На бесплатное занятие распространяются те же правила, что и на любое другое, и несколько собственных.

Оно предоставляется аккаунтам, которые соответствуют условиям в период действия предложения, по одному на аккаунт, и соответствие условиям определяется датой создания аккаунта, а не тем, что вы делаете после.

Его можно использовать только на занятия в пределах собственного периода предложения, который показывается вам при начислении занятия и обычно короче срока купленного пакета. Оно истекает в указанную дату и не продлевается.

Бесплатное занятие не возмещается деньгами, его нельзя передать или разделить с кем-то, а студия может в любой момент изменить или отменить предложение. Уже начисленные занятия сохраняются на тех условиях, на которых были начислены.`,
  },
  {
    title: "Ваше здоровье и честность с нами",
    body: `Пилатес на реформере — это упражнения на тренажёре с пружинами. Записываясь на занятие, вы подтверждаете, что достаточно здоровы, чтобы в нём участвовать, и что вам не известно ничего, что делало бы его небезопасным для вас.

Сообщите студии обо всём, к чему следует отнестись внимательно: о травме, заболевании, недавней операции, беременности, движении, которое причиняет боль. Для этого есть поле при регистрации и в вашем аккаунте, а если вам удобнее сказать это вслух, администратор запишет. Эти сведения остаются между вами, стойкой администратора и инструктором вашего занятия.

Если что-то изменится, сообщите нам. Инструктор, который не знает о вашем плече, не сможет это учесть.

Инструкторы студии имеют квалификацию для преподавания пилатеса, но не являются врачами. Ничто из того, что говорят они или этот сайт, не является медицинской консультацией. Если вы не уверены, можно ли вам заниматься, сначала спросите врача, и, пожалуйста, именно врача, а не просите решить за вас нас.

Инструктор может изменить для вас упражнение, попросить не выполнять его или попросить пропустить занятие, если, по его мнению, это небезопасно. Это решение принимает он, и в зале оно окончательное.`,
  },
  {
    title: "В студии",
    body: `Приходите за несколько минут до начала. Занятие длительностью ${MINUTES} мин, которое начинается ровно в начале часа, не может ждать, а инструктор не может безопасно подготовить кого-то к работе на реформере, когда занятие уже идёт; если вы придёте после начала, вас могут попросить пропустить занятие, и оно будет засчитано как посещённое.

Нескользящие носки обязательны: ради гигиены и потому, что босые ноги скользят на движущейся каретке.

Пожалуйста, бережно относитесь к оборудованию, инструкторам и четырём другим людям в зале. Студия может попросить человека уйти, а в серьёзном случае закрыть его аккаунт, если его поведение делает пребывание в зале небезопасным или неприятным для других. Занятия в этом случае не возмещаются.`,
  },
  {
    title: "Изменения со стороны студии",
    body: `Расписание, инструкторы и цены могут меняться. Если изменение касается занятия, на которое вы уже записаны, вам сообщат, а если занятие отменяется, оно возвращается на ваш баланс.

Инструктор, указанный у занятия, — это намерение студии, а не обещание: графики меняются, люди болеют, а занятие всё равно проходит. Если у занятия, на которое вы записаны, меняется инструктор, вам сообщат.

Цены меняются только на будущее. Пакет, который вы уже купили, сохраняет цену, которую вы заплатили, и условия, на которых вы его купили.

Студия закрыта в официальные праздничные дни и может закрываться на техническое обслуживание или по не зависящим от неё причинам. О закрытиях объявляется, записи на это время отменяются, а занятия возвращаются на баланс.`,
  },
  {
    title: "Если что-то пошло не так",
    body: `Студия отвечает за то, чтобы проводить оплаченные вами занятия с разумной профессиональной квалификацией и заботой, и за надлежащее техническое состояние своего оборудования.

Студия не несёт ответственности за травмы, полученные в результате несоблюдения указаний инструктора, использования оборудования способом, от которого вас предостерегали, или состояния здоровья, о котором вы решили нам не сообщать. Студия не несёт ответственности за вещи, оставленные в студии.

Ничто в настоящих условиях не ограничивает ответственность, которая не может быть ограничена по закону, в том числе ответственность за смерть или вред здоровью, причинённые по небрежности, или за мошенничество. Ваши права потребителя по законодательству Кипра и Европейского союза действуют независимо от того, что сказано на этой странице, и в случае противоречия преимущественную силу имеют они.`,
  },
  {
    title: "Жалобы и применимое право",
    body: `Если что-то не так, сначала сообщите об этом студии: ${MAIL}, ${TEL} или сотруднику на стойке администратора. Большинство вопросов можно решить в разговоре.

Настоящие условия регулируются правом Республики Кипр, и споры подсудны судам Кипра. Как потребитель вы сохраняете право обратиться в суд по месту своего жительства.

Студия может изменять настоящие условия. Если изменение касается вас, вам сообщат об этом, а не оставят обнаруживать самостоятельно. Продолжая пользоваться аккаунтом после изменения, вы принимаете версию, опубликованную здесь.

Последнее обновление: ноябрь 2026.`,
  },
];

const COOKIES_EL: LegalSection[] = [
  {
    title: "Με λίγα λόγια",
    body: `Η σελίδα δεν έχει διαφήμιση, δεν έχει στατιστικά και δεν έχει παρακολούθηση κανενός είδους. Τίποτα εδώ δεν αναφέρει σε κανέναν τι κοιτάς, και δεν υπάρχει σενάριο τρίτου σε καμία σελίδα εκτός από τη σελίδα πληρωμής, όπου φορτώνουν τα πεδία κάρτας του παρόχου πληρωμών.

Αυτό που αποθηκεύει είναι τρία cookies και μία προτίμηση, που αναφέρονται παρακάτω. Δύο από τα cookies είναι ο τρόπος με τον οποίο η σελίδα ξέρει ότι είσαι συνδεδεμένος· χωρίς αυτά δεν μπορεί να λειτουργήσει καθόλου. Το τρίτο θυμάται τη γλώσσα που επέλεξες.

Δεν υπάρχει αναδυόμενο μήνυμα που να σου ζητά να συμφωνήσεις με κάτι από αυτά, και αυτό είναι σκόπιμο και όχι παράλειψη. Δύο από τα cookies είναι απολύτως απαραίτητα, που δεν χρειάζονται άδεια. Το τρίτο γράφεται μόνο τη στιγμή που πατάς τον διακόπτη γλώσσας, δηλαδή όταν το ζητάς εσύ. Τίποτα προαιρετικό δεν μπαίνει στη συσκευή σου πριν κάνεις κάτι που το ζητά.`,
  },
  {
    title: "Απολύτως απαραίτητα, και μη προαιρετικά",
    body: `**apex_session.** Τίθεται όταν συνδέεσαι, και είναι αυτό που σε κρατά συνδεδεμένο. Περιέχει υπογεγραμμένο διακριτικό με το αναγνωριστικό του λογαριασμού σου, το όνομα, το email και τον ρόλο σου. Δεν μπορεί να το διαβάσει κανένα σενάριο, ούτε το δικό μας, και διαρκεί τριάντα ημέρες ή μέχρι να αποσυνδεθείς.

**apex_desk.** Μόνο για το προσωπικό του στούντιο. Η κονσόλα ζητά κωδικό ξανά ακόμη κι αν κάποιος είναι συνδεδεμένος, και αυτό θυμάται ότι δόθηκε. Διαρκεί δεκαπέντε λεπτά αδράνειας και μετά η κονσόλα κλειδώνει, γιατί βρίσκεται σε πάγκο σε χώρο από τον οποίο περνά κοινό.

Κανένα από τα δύο δεν τίθεται πριν συνδεθείς, και κανένα δεν μπορεί να απορριφθεί όσο είσαι συνδεδεμένος: δεν είναι τρόπος να μάθουμε κάτι για σένα, είναι ο μηχανισμός με τον οποίο η σελίδα ξέρει ποιος ρωτά.`,
  },
  {
    title: "Μία προτίμηση, που τίθεται μόνο όταν τη ζητήσεις",
    body: `**apex_locale.** Θυμάται αν διαβάζεις τη σελίδα στα Ελληνικά, στα Αγγλικά ή στα Ρωσικά, ώστε να ανοίξει στη σωστή γλώσσα την επόμενη φορά. Τίθεται τη στιγμή που χρησιμοποιείς τον διακόπτη γλώσσας, διαρκεί έναν χρόνο, και δεν περιέχει τίποτα άλλο από "en", "el" ή "ru".

**Η υπενθύμιση ειδοποιήσεων.** Αν απορρίψεις το μήνυμα που ρωτά αν θέλεις υπενθυμίσεις μαθημάτων στο κινητό σου, η απόφαση θυμάται στην αποθήκευση του browser σου ώστε να μη ρωτηθείς ξανά σε εκείνη τη συσκευή. Περιέχει μια ημερομηνία και τίποτα άλλο, δεν φεύγει ποτέ από τη συσκευή σου, και το στούντιο δεν μπορεί να τη διαβάσει.

Κανένα από τα δύο δεν εμφανίζεται αν δεν κάνεις κάτι. Αν δεν αγγίξεις ποτέ τον διακόπτη γλώσσας δεν υπάρχει καθόλου apex_locale· αν δεν απορρίψεις ποτέ το μήνυμα των ειδοποιήσεων δεν θυμάται τίποτα. Διαγράψε τα και η σελίδα λειτουργεί κανονικά: απλώς θα ανοίγει στην προεπιλεγμένη γλώσσα κάθε φορά, και μπορεί να ρωτήσει ξανά για τις ειδοποιήσεις.`,
  },
  {
    title: "Ο πάροχος πληρωμών, μόνο στη σελίδα πληρωμής",
    body: `Όταν πας να πληρώσεις, τα πεδία της κάρτας παρέχονται από τον πάροχο πληρωμών του στούντιο, ο οποίος θέτει τα δικά του cookies για να εντοπίζει απάτες και να κρατά μαζί μια απόπειρα πληρωμής όταν ανανεωθεί η σελίδα.

Φορτώνουν μόνο στη σελίδα πληρωμής, μόνο όταν είσαι συνδεδεμένος και όντως πληρώνεις, και είναι απαραίτητα για να γίνει η πληρωμή με ασφάλεια. Ο πάροχος δημοσιεύει τη δική του πολιτική για τα cookies· γράψε στο ${MAIL} και το στούντιο θα σου πει ποιος είναι και πού να τη διαβάσεις.

Το στούντιο δεν μπορεί να τα απενεργοποιήσει και να συνεχίσει να δέχεται πληρωμές με κάρτα. Αν προτιμάς να μην τα έχεις, πλήρωσε στην υποδοχή.`,
  },
  {
    title: "Άλλα αιτήματα που κάνει ο browser σου",
    body: `Δύο πράγματα αξίζουν αναφορά αν και δεν θέτουν cookie, γιατί μια σελίδα για τα cookies που δεν έλεγε τίποτα για αυτά θα ήταν παράξενο είδος ειλικρίνειας.

**Γραμματοσειρές.** Οι γραμματοσειρές της σελίδας ζητούνται από εξωτερική υπηρεσία γραμματοσειρών, που σημαίνει ότι εκείνη βλέπει τη διεύθυνση δικτύου της συσκευής σου και τι είδους browser είναι. Δεν τίθεται cookie και δεν αποθηκεύεται τίποτα στη συσκευή σου. Το στούντιο μπορεί να σερβίρει μόνο του τις γραμματοσειρές, που θα αφαιρούσε εντελώς το αίτημα, και είναι μία μόνο αλλαγή αν το προτιμάς: πες το μας.

**Ειδοποιήσεις.** Αν ενεργοποιήσεις τις υπενθυμίσεις μαθημάτων, παραδίδονται μέσω της υπηρεσίας push του δικού σου browser, που εξαρτάται από τη συσκευή σου. Η σχέση αυτή είναι μεταξύ του browser σου και του κατασκευαστή του· το στούντιο κρατά μόνο τη διεύθυνση που του δίνει εκείνη η υπηρεσία για τη συσκευή σου, και τη διαγράφει όταν απενεργοποιήσεις τις ειδοποιήσεις.

Η διαγραφή των cookies παραπάνω δεν σταματά κανένα από τα δύο, και θα ήταν παραπλανητικό να υπονοηθεί το αντίθετο. Το πρώτο είναι αίτημα για ένα αρχείο· το δεύτερο γίνεται μόνο αν το ζητήσεις.`,
  },
  {
    title: "Πώς τα αφαιρείς, με τις ρυθμίσεις του browser σου",
    body: `Κάθε browser μπορεί να σου δείξει τα cookies που έθεσε μια σελίδα και να τα διαγράψει, συνήθως κάτω από Απόρρητο ή Ρυθμίσεις ιστότοπου. Καθαρίζοντάς τα για αυτή τη σελίδα αφαιρείς μαζί το cookie της γλώσσας και την υπενθύμιση των ειδοποιήσεων, και η σελίδα ξαναβάζει μόνο ό,τι της ζητήσεις.

Ο browser σου μπορεί επίσης να μπλοκάρει τα cookies εντελώς. Το μπλοκάρισμα των δύο απαραίτητων θα σε εμποδίσει να συνδεθείς, και αυτό δεν είναι δυστροπία της σελίδας: η σύνδεση είναι αυτά τα cookies.

Τελευταία ενημέρωση: Νοέμβριος 2026.`,
  },
];

/** Russian cookies page, translated from COOKIES_EN (see the note in its first section). */
const COOKIES_RU: LegalSection[] = [
  {
    title: "О переводе",
    body: `Этот текст — перевод английской версии, сделанный для вашего удобства, и мы старались передать её точно. Если вы заметите расхождение, напишите нам на ${MAIL}, и мы исправим перевод. Любое неясное или расходящееся место толкуется в вашу пользу, и ничто в этом переводе не ограничивает ваши права как потребителя.`,
  },
  {
    title: "Коротко",
    body: `На этом сайте нет ни рекламы, ни аналитики, ни отслеживания в каком-либо виде. Ничто здесь никому не сообщает, что вы просматриваете, и ни на одной странице нет сторонних скриптов, кроме страницы оплаты, где загружаются поля для карты платёжного провайдера.

Сайт хранит три cookie-файла и одну настройку, они перечислены ниже. Два cookie-файла позволяют сайту знать, что вы вошли в аккаунт; без них он вообще не может работать. Третий запоминает выбранный вами язык.

Здесь нет всплывающего окна с просьбой согласиться на всё это, и это сделано намеренно, а не по недосмотру. Два cookie-файла строго необходимы, а для таких разрешение не требуется. Третий записывается только в тот момент, когда вы нажимаете переключатель языка, то есть когда вы сами об этом просите. Ничего необязательного не сохраняется на вашем устройстве, пока вы не сделаете что-то, что этого требует.`,
  },
  {
    title: "Строго необходимые и обязательные",
    body: `**apex_session.** Устанавливается при входе в аккаунт и обеспечивает, что вы остаётесь в нём. Содержит подписанный токен с идентификатором вашего аккаунта, вашим именем, адресом электронной почты и ролью. Его не может прочитать ни один скрипт, включая наши, и он действует тридцать дней или до выхода из аккаунта.

**apex_desk.** Только для сотрудников студии. Консоль администратора повторно запрашивает пароль, даже если сотрудник уже вошёл в систему, и этот cookie-файл запоминает, что пароль был введён. Он перестаёт действовать после пятнадцати минут бездействия, и консоль блокируется, потому что стоит на стойке в помещении, через которое проходят посетители.

Ни один из них не устанавливается до входа в аккаунт, и ни от одного нельзя отказаться, пока вы в аккаунте: они нужны не для того, чтобы что-то о вас узнать, а для того, чтобы сайт понимал, кто к нему обращается.`,
  },
  {
    title: "Настройка, которая сохраняется, только если вы об этом просите",
    body: `**apex_locale.** Запоминает, на каком языке вы читаете сайт, английском, греческом или русском, чтобы в следующий раз он открылся на нужном языке. Устанавливается в момент, когда вы пользуетесь переключателем языка, хранится один год и не содержит ничего, кроме «en», «el» или «ru».

**Отметка об уведомлениях.** Если вы отклоните запрос о том, хотите ли получать напоминания о занятиях на телефон, это решение запоминается во встроенном хранилище вашего браузера, чтобы на этом устройстве вас больше не спрашивали. Там хранится только дата, она никогда не покидает ваше устройство, и студия не может её прочитать.

Ни то ни другое не появляется без ваших действий. Если вы ни разу не нажмёте переключатель языка, apex_locale не будет вовсе; если ни разу не отклоните запрос об уведомлениях, ничего не запоминается. Удалите их, и сайт продолжит работать: просто каждый раз будет открываться на языке по умолчанию и, возможно, снова спросит об уведомлениях.`,
  },
  {
    title: "Платёжный провайдер, только на странице оплаты",
    body: `Когда вы переходите к оплате, поля для карты предоставляет платёжный провайдер студии, который устанавливает собственные cookie-файлы, чтобы выявлять мошенничество и не терять попытку оплаты при перезагрузке страницы.

Они загружаются только на странице оплаты, только когда вы вошли в аккаунт и действительно платите, и они необходимы для безопасного приёма платежа. Провайдер публикует собственную политику использования cookie-файлов; напишите на ${MAIL}, и студия сообщит, что это за провайдер и где с этой политикой ознакомиться.

Студия не может отключить их и при этом продолжать принимать оплату картой. Если вы не хотите их получать, оплачивайте на стойке администратора.`,
  },
  {
    title: "Другие запросы вашего браузера",
    body: `Две вещи стоит назвать, хотя они и не устанавливают cookie-файлов: страница о cookie, которая умалчивала бы о них, была бы странным видом честности.

**Шрифты.** Шрифты на этом сайте загружаются из внешнего сервиса шрифтов, а значит, этот сервис видит сетевой адрес вашего устройства и тип браузера. Cookie-файлы при этом не устанавливаются, и на вашем устройстве ничего не сохраняется. Студия может вместо этого раздавать шрифты сама, что полностью исключило бы этот запрос; это одно изменение, и если вы бы этого хотели, скажите.

**Уведомления.** Если вы включите напоминания о занятиях, они доставляются через push-сервис, которым пользуется ваш браузер; он зависит от вашего устройства. Это отношения между вашим браузером и его разработчиком; студия хранит только адрес, который этот сервис выдаёт для вашего устройства, и удаляет его, когда вы отключаете уведомления.

Удаление перечисленных выше cookie-файлов не останавливает ни то ни другое, и было бы неверно утверждать обратное. Первое — это просто запрос файла, второе происходит только по вашей просьбе.`,
  },
  {
    title: "Как их удалить средствами браузера",
    body: `Любой браузер может показать cookie-файлы, установленные сайтом, и удалить их, обычно в разделе «Конфиденциальность» или «Настройки сайтов». Если очистить их для этого сайта, будут удалены и языковой cookie-файл, и отметка об уведомлениях, а сайт вернёт только то, о чём вы его попросите.

Браузер также может полностью блокировать cookie-файлы. Если заблокировать два необходимых, вы не сможете войти в аккаунт, и это не каприз сайта: вход в аккаунт и есть эти cookie-файлы.

Последнее обновление: ноябрь 2026.`,
  },
];

/** Every document in every language. Anything that is not "el" or "ru" is English. */
const DOCUMENTS: Record<"en" | "el" | "ru", Record<LegalKind, LegalSection[]>> = {
  en: { privacy: PRIVACY_EN, terms: TERMS_EN, cookies: COOKIES_EN },
  el: { privacy: PRIVACY_EL, terms: TERMS_EL, cookies: COOKIES_EL },
  ru: { privacy: PRIVACY_RU, terms: TERMS_RU, cookies: COOKIES_RU },
};

export function legalSections(
  kind: LegalKind,
  locale: string,
): LegalSection[] {
  const lang = locale === "el" || locale === "ru" ? locale : "en";
  return DOCUMENTS[lang][kind];
}
