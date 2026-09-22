import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  CalendarCheck, ClipboardList, GraduationCap, MessageSquare, Palette,
  PenSquare, ScrollText, Smartphone, Wallet,
} from 'lucide-react'
import { currentUser } from '@/lib/auth'
import { listPlans } from '@/lib/billing'
import { PROVIDERS } from '@/lib/payments/providers'
import { AppPreview } from '@/components/marketing/app-preview'
import { PricingBands } from '@/components/marketing/pricing'
import { ArrowButton, CheckLine, Eyebrow, SplitHeading } from '@/components/marketing/bits'
import { MarketingHeader } from '@/components/marketing/header'

export const metadata: Metadata = {
  // absolute, or the root layout's '%s · SchoolHub' template appends the
  // brand a second time.
  title: { absolute: 'SchoolHub — one system for the whole school' },
  description:
    'Enrolment, attendance, results, fees and a pupil portal for multi-campus school operators. Built for Nigerian schools and configurable for other markets.',
  openGraph: {
    title: 'SchoolHub — one system for the whole school',
    description:
      'Enrolment, attendance, results, fees and a pupil portal, built around a term and a class arm rather than a spreadsheet.',
    type: 'website',
  },
}

// Everything named here is built and in the product. Nothing on this page is a
// promise about work that has not shipped; the roadmap question below says
// plainly what is missing instead.
const FEATURES = [
  {
    icon: GraduationCap,
    title: 'Enrolment as the spine',
    body: 'A pupil is never loosely "in JSS 2". They hold an enrolment binding them to a class arm, in a term, of a session — so attendance, results and fees hang off something real.',
    href: '/login',
  },
  {
    icon: CalendarCheck,
    title: 'Attendance that survives the network',
    body: 'A register is designed at 360px and saves in one request or not at all. A teacher can amend it afterwards, and every change is written to the audit log.',
    href: '/login',
  },
  {
    icon: ClipboardList,
    title: 'Results and report cards',
    body: 'CA and exam weighting, grade bands and pass marks are settings, not code. Report cards compute from them and print properly on A4.',
    href: '/login',
  },
  {
    icon: PenSquare,
    title: 'Computer-based tests',
    body: 'Author a paper, publish it to a class level, let pupils sit it in a timed window. Marking runs server-side against a key no candidate can read.',
    href: '/login',
  },
  {
    icon: Wallet,
    title: 'Fees and online payment',
    body: 'Build a fee structure, raise invoices across a class in one operation, and take card payments. Cash and transfers are recorded by the bursary.',
    href: '#pricing',
  },
  {
    icon: Smartphone,
    title: 'A portal for pupils',
    body: 'Pupils see their own attendance, results and invoices, sit their tests, message staff, and pay their fees from a phone.',
    href: '/login',
  },
]

const FAQ = [
  {
    q: 'Can one school see another school’s data?',
    a: 'No, and not because the application remembers to filter. Every table carries a school id and isolation is enforced by Postgres row-level security, enabled and forced, deny-by-default. A missing policy returns nothing rather than everything. Cross-tenant isolation is asserted by a test suite that runs on every commit.',
  },
  {
    q: 'Does it assume three terms and a Nigerian grading scale?',
    a: 'It ships with those, but they are data, not code. Terms per session, CA and exam weighting, grade bands, pass marks, promotion rules, currency, locale and date format are all settings. A different country is a new preset, not a new version.',
  },
  {
    q: 'Our teachers use cheap phones on poor connections.',
    a: 'That is the assumption the screens were designed against. Registers and rosters are laid out at 360px first and widened from there, and a register saves in a single request so a dropped connection cannot half-save a class.',
  },
  {
    q: 'We print everything. Does that work?',
    a: 'Yes. Report cards, invoices, registers and rosters carry print stylesheets: tints and shadows drop away, headers repeat across pages, and rows do not break in half.',
  },
  {
    q: 'What is deliberately not in it yet?',
    a: 'A guardian login, SMS, timetabling, library, transport, hostel and analytics dashboards are not built. We would rather say so than list them as features. Guardians can pay a pupil’s fees today, but they do not yet have an account of their own.',
  },
  {
    q: 'How do we get started?',
    a: 'Accounts are created by invitation, so get in touch and we will set your school up with its classes, terms and staff, and walk you through the first term rollover. The first 30 days are free.',
  },
]

export default async function Landing() {
  // Signed-in people have somewhere better to be.
  if (await currentUser()) redirect('/dashboard')

  const plans = await listPlans()
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL
  const primaryHref = contact
    ? `mailto:${contact}?subject=${encodeURIComponent('SchoolHub for our school')}`
    : '/login'
  const primaryLabel = contact ? 'Request access' : 'Sign in to your school'

  return (
    <div className="min-h-dvh">
      <MarketingHeader
        primaryHref={primaryHref}
        primaryLabel={contact ? 'Get started' : 'Sign in'}
        showSignIn={Boolean(contact)}
      />

      <main id="main">
        {/* ------------------------------------------------------------ hero */}
        {/* The wash lives on the section itself, and the grid overlay sits at
            z-0 with the content above it. A decorative layer at -z-10 is
            invisible here: body carries an opaque background, and negative
            z-index descendants paint underneath it. */}
        <section
          className="relative -mt-[72px] overflow-hidden pt-[72px]"
          style={{
              // Mixed from the accent rather than from --color-accent-soft:
              // that tint and the canvas sit within a few points of each other
              // in lightness, so a wash built from it is invisible.
              background:
                'radial-gradient(46rem 26rem at 76% -10%, color-mix(in srgb, var(--color-accent) 22%, transparent), transparent 70%),' +
                'radial-gradient(36rem 22rem at 6% 2%, color-mix(in srgb, var(--color-icon-sky) 16%, transparent), transparent 66%),' +
                'linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 7%, transparent) 0%, transparent 58%)',
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 opacity-90"
            style={{
              backgroundImage:
                'linear-gradient(color-mix(in srgb, var(--color-accent) 14%, transparent) 1px, transparent 1px),' +
                'linear-gradient(90deg, color-mix(in srgb, var(--color-accent) 14%, transparent) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
              maskImage: 'radial-gradient(46rem 24rem at 45% 2%, #000, transparent 72%)',
              WebkitMaskImage: 'radial-gradient(46rem 24rem at 45% 2%, #000, transparent 72%)',
            }}
          />

          <div className="relative z-10 mx-auto max-w-6xl px-4 pt-4 pb-16 sm:px-6 sm:pt-8">
            <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-surface py-1 pr-3 pl-1 text-[12px] font-semibold shadow-[var(--shadow-card)]">
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold tracking-wide text-accent-ink uppercase">
                    New
                  </span>
                  Pupil portal, CBT and fees are live
                </span>

                <h1 className="mt-5 text-[36px] leading-[1.06] font-bold tracking-[-0.035em] sm:text-[52px]">
                  One system for the{' '}
                  <span className="text-accent">whole school</span>
                </h1>

                <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-muted sm:text-[17px]">
                  Enrolment, attendance, results, fees and a pupil portal — built around a term and
                  a class arm instead of a spreadsheet, and designed for the phone a teacher
                  actually owns.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <ArrowButton href={primaryHref}>{primaryLabel}</ArrowButton>
                  {contact ? (
                    <Link
                      href="/login"
                      className="inline-flex h-12 items-center rounded-full px-4 text-sm font-semibold text-ink hover:text-accent-on-soft"
                    >
                      Sign in to your school
                    </Link>
                  ) : null}
                </div>

                <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2">
                  <CheckLine>30 days free</CheckLine>
                  <CheckLine>No card to start</CheckLine>
                  <CheckLine>Cancel anytime</CheckLine>
                </ul>
              </div>

              <div className="relative">
                <div
                  aria-hidden
                  className="absolute -inset-4 -z-10 rounded-[30px] bg-accent/10 blur-2xl"
                />
                <AppPreview />
              </div>
            </div>
          </div>
        </section>

        {/* What a logo cloud would sit in. These are the gateways the product
            actually integrates, not customers — inventing school names to fill
            this strip would be a lie a buyer could check. */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-9 sm:px-6">
            <p className="text-center text-[11px] font-bold tracking-[0.12em] text-ink-muted uppercase">
              Take school fees through the gateway you already use
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
              {Object.values(PROVIDERS).map((p) => (
                <span key={p.key} className="text-[17px] font-bold tracking-[-0.02em] text-ink/45">
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="text-center">
            <Eyebrow>Features</Eyebrow>
            <SplitHeading
              className="mt-4 text-[28px] leading-[1.15] font-bold tracking-[-0.03em] sm:text-[36px]"
              lead="Everything a school runs on,"
              accent="already built"
            />
            <p className="mx-auto mt-3 max-w-xl text-[15px] text-ink-muted">
              Every item here is in the product today, not on a roadmap.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body, href }) => (
              <div
                key={title}
                className="group rounded-[18px] bg-surface p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-raised)]"
              >
                <span className="grid size-11 place-items-center rounded-2xl bg-accent-soft text-accent-on-soft">
                  <Icon size={20} aria-hidden />
                </span>
                <h3 className="mt-4 text-[15px] font-bold">{title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-muted">{body}</p>
                <Link
                  href={href}
                  className="mt-3.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent-on-soft"
                >
                  Learn more
                  <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------------- security */}
        <section id="security" className="scroll-mt-20 border-y border-line bg-surface">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
            <div className="order-2 lg:order-1">
              <div aria-hidden className="relative">
                <div className="absolute -inset-4 -z-10 rounded-[30px] bg-accent/8 blur-2xl" />
                <AppPreview variant="roster" />
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <Eyebrow>Built for groups</Eyebrow>
              <SplitHeading
                className="mt-4 text-[28px] leading-[1.15] font-bold tracking-[-0.03em] sm:text-[36px]"
                lead="Many schools, one database,"
                accent="no leaks"
              />
              <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
                Run a group without running a copy of the software for each school. Every table
                carries a school id, and separation is enforced by the database rather than by
                application code remembering to add a filter.
              </p>
              <ul className="mt-6 grid gap-3">
                <CheckLine>Row-level security enabled and forced on every table, deny by default</CheckLine>
                <CheckLine>A missing policy returns nothing, never everything</CheckLine>
                <CheckLine>Cross-tenant, role and pupil isolation asserted on every commit</CheckLine>
                <CheckLine>Exam answer keys live where no candidate can read them</CheckLine>
                <CheckLine>Every mutation recorded with who, what, before and after</CheckLine>
              </ul>
              <div className="mt-8">
                <ArrowButton href={primaryHref} tone="surface">{primaryLabel}</ArrowButton>
              </div>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- the rest */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Eyebrow>Made yours</Eyebrow>
              <SplitHeading
                className="mt-4 text-[28px] leading-[1.15] font-bold tracking-[-0.03em] sm:text-[36px]"
                lead="Your rules, your colours,"
                accent="your paperwork"
              />
              <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
                Nothing about a term structure or a grading scale is hard-coded, so the system bends
                to how your school already works instead of the other way round.
              </p>
              <ul className="mt-6 grid gap-3">
                <CheckLine>Terms per session, CA weighting, grade bands and pass marks are settings</CheckLine>
                <CheckLine>Currency, locale and date format follow the school, not the server</CheckLine>
                <CheckLine>Your logo and brand colour carry into the portal and the report card</CheckLine>
                <CheckLine>Everything an administrator would print has a real print stylesheet</CheckLine>
              </ul>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: MessageSquare, title: 'Messaging', body: 'Staff and pupils, inside one school.' },
                { icon: ScrollText, title: 'Audit log', body: 'Who changed what, and what it was before.' },
                { icon: Palette, title: 'Branding', body: 'Logo and colour, contrast checked.' },
                { icon: Wallet, title: 'Bursary tools', body: 'Invoices, part payments, reconciliation.' },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-[18px] bg-surface p-5 shadow-[var(--shadow-card)]">
                  <span className="grid size-10 place-items-center rounded-2xl bg-accent-soft text-accent-on-soft">
                    <Icon size={18} aria-hidden />
                  </span>
                  <p className="mt-3 text-[14px] font-bold">{title}</p>
                  <p className="mt-1 text-[13px] text-ink-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <PricingBands plans={plans} contact={contact} />

        {/* ------------------------------------------------------------- faq */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="text-center">
            <Eyebrow>FAQ</Eyebrow>
            <SplitHeading
              className="mt-4 text-[28px] leading-[1.15] font-bold tracking-[-0.03em] sm:text-[36px]"
              lead="Questions schools"
              accent="actually ask"
            />
          </div>
          <div className="mt-10 space-y-3">
            {FAQ.map(({ q, a }) => (
              <details
                key={q}
                className="group rounded-[18px] bg-surface p-5 shadow-[var(--shadow-card)]"
              >
                <summary className="cursor-pointer list-none text-[15px] font-bold marker:hidden">
                  <span className="flex items-start justify-between gap-4">
                    {q}
                    <span
                      aria-hidden
                      className="mt-0.5 shrink-0 text-ink-muted transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ----------------------------------------------------------- close */}
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="relative overflow-hidden rounded-[26px] bg-accent px-6 py-14 text-center sm:px-10">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  'linear-gradient(var(--color-accent-ink) 1px, transparent 1px),' +
                  'linear-gradient(90deg, var(--color-accent-ink) 1px, transparent 1px)',
                backgroundSize: '44px 44px',
                maskImage: 'radial-gradient(28rem 14rem at 50% 0%, #000, transparent 70%)',
                WebkitMaskImage: 'radial-gradient(28rem 14rem at 50% 0%, #000, transparent 70%)',
              }}
            />
            <h2 className="text-[28px] font-bold tracking-[-0.03em] text-accent-ink sm:text-[34px]">
              Put the whole school on one system.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[15px] text-accent-ink/80">
              We set up your classes, terms and staff, and stay with you through the first term
              rollover.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ArrowButton href={primaryHref} tone="surface">{primaryLabel}</ArrowButton>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-8 text-[13px] text-ink-muted sm:px-6">
          <span className="flex items-center gap-2 font-semibold text-ink">
            <GraduationCap size={15} aria-hidden className="text-ink-muted" />
            SchoolHub
          </span>
          <span>© {new Date().getFullYear()}</span>
          <Link href="/login" className="ml-auto hover:text-ink">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  )
}
