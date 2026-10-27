import Image from "next/image";
import {
  BookOpen,
  Check,
  ClipboardCheck,
  MessageSquare,
  Newspaper,
} from "lucide-react";
import SiteFooter from "../../components/site-footer";
import SiteNavbar from "../../components/site-navbar";
import { mentors } from "../../lib/team";

const WHAT_WE_DO = [
  {
    title: "Ask a Question",
    description: "Get a clear answer, written for the marks you choose.",
    icon: MessageSquare,
  },
  {
    title: "Study by Chapter",
    description: "Learn one chapter at a time, step by step.",
    icon: BookOpen,
  },
  {
    title: "Learning Outcomes",
    description: "See the SLOs you are expected to master.",
    icon: ClipboardCheck,
  },
  {
    title: "Past Paper Practice",
    description: "Practise with questions from AKU-EB model papers.",
    icon: Newspaper,
  },
] as const;

const REASONS = [
  "Content aligned with the AKU-EB syllabus",
  "Answers marked with textbook verification labels",
  "Chapter-wise study and practice in one place",
  "Marks-wise answers (2, 3, 5 and 8 marks) written the way examiners expect",
] as const;

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function AboutPage() {
  return (
    <div className="babul-home info-page">
      <SiteNavbar />
      <main>
        <section className="info-hero">
          <div className="home-hero-grid-pattern" aria-hidden="true" />
          <div className="info-hero-inner">
            <h1>
              Learning AKU-EB,
              <br />
              <span>made simple.</span>
            </h1>
            <p className="info-hero-copy">
              Babul Learn is an AI-powered study companion built for students
              preparing for AKU-EB examinations. We bring chapter-wise notes,
              learning outcomes, past paper practice and instant answers
              together in one place, so you spend less time searching and more
              time learning.
            </p>
          </div>
        </section>

        <div className="info-content">
          <section className="info-section" aria-labelledby="what-we-do">
            <div className="info-section-heading">
              <h2 className="info-heading" id="what-we-do">
                What we <span>do</span>
              </h2>
              <p className="info-section-copy">
                Choose your class and subject, and Babul Learn shows you exactly
                what you need. Every answer carries a textbook verification
                label, so you always know where it comes from.
              </p>
            </div>
            <div className="info-service-grid">
              {WHAT_WE_DO.map(({ title, description, icon: Icon }) => (
                <article className="info-service-card" key={title}>
                  <span className="info-icon-tile" aria-hidden="true">
                    <Icon size={22} strokeWidth={2} />
                  </span>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="info-mission" aria-labelledby="mission-heading">
            <div>
              <h2 className="info-heading" id="mission-heading">
                Our <span>mission</span>
              </h2>
            </div>
            <p>
              To make quality exam preparation simple, affordable and
              available to every student in Pakistan, whether you study in a
              big city or a small town.
            </p>
          </section>

          <section className="info-section" aria-labelledby="why-choose-us">
            <div className="info-section-heading">
              <h2 className="info-heading" id="why-choose-us">
                Why students choose <span>us</span>
              </h2>
            </div>
            <ul className="info-reasons-grid">
              {REASONS.map((reason) => (
                <li className="info-reason" key={reason}>
                  <span className="info-icon-tile info-check-tile" aria-hidden="true">
                    <Check size={18} strokeWidth={2} />
                  </span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="info-section info-mentors" aria-labelledby="mentors-heading">
            <div className="info-section-heading">
              <h2 className="info-heading" id="mentors-heading">
                Mentors &amp; <span>Supporters</span>
              </h2>
              <p className="info-section-copy">
                Babul Learn exists because of the people who guided and
                supported us along the way.
              </p>
            </div>
            <div className="info-mentor-grid">
              {mentors.map((mentor) => (
                <article className="info-mentor-card" key={mentor.name}>
                  <div className="info-mentor-avatar" aria-hidden="true">
                    {mentor.photo ? (
                      <Image
                        src={mentor.photo}
                        alt=""
                        fill
                        sizes="56px"
                        className="info-mentor-photo"
                      />
                    ) : (
                      initials(mentor.name)
                    )}
                  </div>
                  <div className="info-mentor-details">
                    <h3>{mentor.name}</h3>
                    <p className="info-mentor-role">{mentor.role}</p>
                    <p className="info-mentor-note">{mentor.note}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <p className="info-karachi">Proudly built in Karachi, Pakistan.</p>
          <p className="info-disclaimer">
            Babul Learn is an independent educational platform. It is not
            affiliated with, endorsed by or sponsored by the Aga Khan
            University Examination Board. AI answers may contain mistakes, so
            please check them against your textbook.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
