"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  ArrowUpRight,
  BookOpen,
  ChartColumn,
  ChevronDown,
  ClipboardCheck,
  GraduationCap,
  Lock,
  MessageSquare,
  Newspaper,
  PencilLine,
} from "lucide-react";
import SiteFooter from "../components/site-footer";
import SiteNavbar from "../components/site-navbar";
import {
  CURRICULUM,
  SCHOOL_CLASSES,
  isSchoolClass,
  selectionHref,
  subjectSlug,
  type SchoolClass,
} from "../lib/curriculum";
import { useSelection } from "../lib/selection-context";

type HomePageProps = {
  initialClass: SchoolClass | null;
  initialSubject: string | null;
  showSelectionMessage?: boolean;
};

const QUICK_ACTIONS = [
  { label: "Ask a Question", path: "chat", icon: MessageSquare },
  { label: "Study by Chapter", path: "chapters", icon: BookOpen },
  { label: "View Learning Outcomes", path: "slos", icon: ClipboardCheck },
  { label: "AKU-EB Past Papers", path: "past-papers", icon: Newspaper },
  { label: "Practice Questions", path: "practice", icon: PencilLine },
  { label: "My Progress", path: "progress", icon: ChartColumn },
] as const;

function classLabel(value: SchoolClass): string {
  return `Class ${value}`;
}

export default function HomePage({
  initialClass,
  initialSubject,
  showSelectionMessage = false,
}: HomePageProps) {
  const router = useRouter();
  const { setSelection } = useSelection();
  const [schoolClass, setSchoolClass] = useState<SchoolClass | null>(
    initialClass,
  );
  const [selectedSubjectSlug, setSelectedSubjectSlug] = useState<string | null>(
    initialSubject,
  );
  const subject = selectedSubjectSlug
    ? CURRICULUM[schoolClass ?? "IX"].find(
        (item) => subjectSlug(item) === selectedSubjectSlug,
      ) ?? null
    : null;
  const selectionReady = schoolClass !== null && subject !== null;

  function scrollToSection(id: string, block: ScrollLogicalPosition) {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    document.getElementById(id)?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block,
    });
  }

  function continueToActions() {
    if (!schoolClass || !subject) return;

    const selection = { classLevel: schoolClass, subjectSlug: subjectSlug(subject) };
    setSelection(selection);
    router.replace(selectionHref("/", selection), { scroll: false });
    scrollToSection("quick-actions", "start");
  }

  function selectClass(value: string) {
    if (!isSchoolClass(value)) return;
    setSchoolClass(value);
    setSelectedSubjectSlug(null);
  }

  return (
    <div className="babul-home">
      <SiteNavbar />

      <main>
        <section className="home-hero" id="home">
          <div className="home-hero-grid-pattern" aria-hidden="true" />
          <div className="home-hero-inner">
            <div className="home-hero-copy">
              <span className="home-eyebrow">
                <span className="home-eyebrow-dot" />
                A smarter way to prepare for AKU-EB
              </span>
              <h1>
                Study AKU-EB the
                <br />
                <span>smart way.</span>
              </h1>
              <p className="home-hero-description">
                Textbook-verified answers, chapter notes and past paper
                practice for AKU-EB students.
              </p>

              <section className="home-selector-card" id="selector" aria-labelledby="selector-title">
                {showSelectionMessage && (
                  <p className="mb-4 text-sm font-medium text-emerald-800" role="status">
                    Choose your class and subject first.
                  </p>
                )}
                <div className="home-selector-heading">
                  <span className="home-selector-icon" aria-hidden="true">
                    <GraduationCap size={21} strokeWidth={2} />
                  </span>
                  <h2 id="selector-title">
                    Which class and subject do you need help with today?
                  </h2>
                </div>

                <div className="home-selectors">
                  <label className="home-select-field">
                    <span>Select class</span>
                    <span className="home-select-control">
                      <GraduationCap size={18} aria-hidden="true" />
                      <select
                        value={schoolClass ?? ""}
                        onChange={(event) => selectClass(event.target.value)}
                        aria-label="Select class"
                      >
                        <option value="" disabled>Select class</option>
                        {SCHOOL_CLASSES.map((item) => (
                          <option key={item} value={item}>
                            {classLabel(item)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={17} aria-hidden="true" />
                    </span>
                  </label>

                  <label className="home-select-field">
                    <span>Select subject</span>
                    <span className="home-select-control">
                      <BookOpen size={18} aria-hidden="true" />
                      <select
                        value={selectedSubjectSlug ?? ""}
                        onChange={(event) =>
                          setSelectedSubjectSlug(event.target.value || null)
                        }
                        disabled={!schoolClass}
                        aria-label="Select subject"
                      >
                        <option value="" disabled>Select subject</option>
                        {schoolClass &&
                          CURRICULUM[schoolClass].map((item) => (
                            <option key={item} value={subjectSlug(item)}>{item}</option>
                          ))}
                      </select>
                      <ChevronDown size={17} aria-hidden="true" />
                    </span>
                  </label>
                </div>

                <button
                  type="button"
                  className="home-continue-button"
                  onClick={continueToActions}
                  disabled={!selectionReady}
                >
                  Continue
                  <ArrowRight size={18} strokeWidth={2} />
                </button>
              </section>
            </div>

           

<div className="home-hero-aside" aria-label="Babul Learn features">
  <div className="bl-pill-columns">
    <div className="bl-pill-column">
      <div className="bl-pill bl-pill-green bl-pill-1">
        <strong>AKU-EB<br />aligned</strong>
        <span className="bl-pill-icon"><ClipboardCheck size={34} strokeWidth={1.6} /></span>
      </div>
      <div className="bl-pill bl-pill-amber bl-pill-2">
        <strong>Chapter-wise<br />notes</strong>
        <span className="bl-pill-icon"><BookOpen size={34} strokeWidth={1.6} /></span>
      </div>
    </div>

    <div className="bl-pill-column">
      <div className="bl-pill bl-pill-emerald bl-pill-3">
        <strong>Built for<br />students</strong>
        <span className="bl-pill-icon"><GraduationCap size={34} strokeWidth={1.6} /></span>
      </div>
      <div className="bl-pill bl-pill-dark bl-pill-4">
        <strong>Textbook<br />verified</strong>
        <span className="bl-pill-icon"><BadgeCheck size={34} strokeWidth={1.6} /></span>
      </div>
    </div>

    <div className="bl-pill-column">
      <div className="bl-pill bl-pill-mint bl-pill-5">
        <strong>Past paper<br />practice</strong>
        <span className="bl-pill-icon"><Newspaper size={34} strokeWidth={1.6} /></span>
      </div>
      <div className="bl-pill bl-pill-teal bl-pill-6">
        <strong>Ask syllabus<br />questions</strong>
        <span className="bl-pill-icon"><MessageSquare size={34} strokeWidth={1.6} /></span>
      </div>
    </div>
  </div>
</div>
</div>

        </section>

        <section className="home-quick-section" id="quick-actions" aria-labelledby="quick-title">
          <div className="home-quick-pattern" aria-hidden="true" />
          <div className="home-quick-inner">
            <p className="home-section-kicker">Your learning, your way</p>
            <h2 id="quick-title" className="home-section-title">
              Quick <span>Actions</span>
            </h2>
            <div className="home-selection-pill">
              {selectionReady ? (
                <>
                  <span className="home-selection-dot" />
                  <span>{classLabel(schoolClass)} · {subject}</span>
                  <button
                    type="button"
                    onClick={() => scrollToSection("selector", "center")}
                  >
                    Change
                  </button>
                </>
              ) : (
                <>
                  <Lock size={15} aria-hidden="true" />
                  <span>Choose your class and subject first.</span>
                </>
              )}
            </div>

            <div className={`home-action-grid${selectionReady ? " is-unlocked" : ""}`}>
              {QUICK_ACTIONS.map(({ label, path, icon: Icon }) => {
                const href = selectionReady
                  ? selectionHref(`/${path}`, {
                      classLevel: schoolClass,
                      subjectSlug: subjectSlug(subject),
                    })
                  : "#selector";
                return (
                  <Link
                    key={path}
                    className="home-action-card"
                    href={href}
                    aria-disabled={!selectionReady}
                    tabIndex={selectionReady ? 0 : -1}
                    onClick={(event) => {
                      if (!selectionReady) event.preventDefault();
                    }}
                  >
                    <span className="home-action-open" aria-hidden="true">
                      <ArrowUpRight size={18} />
                    </span>
                    {!selectionReady && (
                      <span className="home-action-lock" aria-label="Locked">
                        <Lock size={15} />
                      </span>
                    )}
                    <span className="home-action-icon">
                      <Icon size={40} strokeWidth={2} aria-hidden="true" />
                    </span>
                    <span className="home-action-label">{label}</span>
                  </Link>
                );
              })}
            </div>
            <p className="home-action-hint">Tap any card to get started.</p>
          </div>
        </section>

        <section className="home-about-section">
          <div>
            <p className="home-section-kicker">Made for focused learning</p>
            <h2 className="home-section-title">A clearer path to <span>understanding.</span></h2>
          </div>
          <p>
            Babul Learn brings AKU-EB study material, syllabus outcomes, and
            practice tools together so students can focus on learning.
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
