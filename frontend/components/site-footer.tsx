
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Mail, BookOpen, GraduationCap } from "lucide-react";

export default function SiteFooter() {
  return (
    <footer className="home-footer">
      <div className="bl-footer-container">
        <div className="bl-footer-main">

          {/* Brand */}
          <div className="bl-footer-brand">
            <Link href="/" className="bl-footer-logo">
              <Image
                src="/babul-learn-logo.png"
                alt="Babul Learn"
                width={64}
                height={64}
              />
              <span>Babul Learn</span>
            </Link>

            <p>
              Study with clarity. Learn with confidence.
              Your AKU-EB learning companion for smarter preparation.
            </p>
          </div>

          {/* Navigation */}
          <div className="bl-footer-column">
            <h3>Explore</h3>
            <Link href="/#home">Home</Link>
            <Link href="/#selector">Subjects</Link>
            <Link href="/past-papers">Past Papers</Link>
            <Link href="/about">About Us</Link>
          </div>

          {/* Resources */}
          <div className="bl-footer-column">
            <h3>Resources</h3>
            <Link href="/#quick-actions">
              <BookOpen size={15} />
              Study Resources
            </Link>
            <Link href="/contact">Contact Us</Link>
            <span className="bl-footer-upcoming">
              <GraduationCap size={15} />
              Aptitude Test
              <small>Coming Soon</small>
            </span>
          </div>

{/* Our Team */}
<div className="bl-footer-column bl-footer-team">
  <h3>Our Team</h3>

  <div className="bl-footer-team-group">
    <span className="bl-footer-team-role">Mentors & Supporters</span>
    <span>Siraj Amin</span>
    <span>M. Ali Abidi</span>
  </div>

  <div className="bl-footer-team-group">
    <span className="bl-footer-team-role">Developed By</span>
    <span>Muhammad Saqlain</span>
  </div>
</div>

          {/* Contact */}
          <div className="bl-footer-column bl-footer-contact">
            <h3>Get in touch</h3>
            <p>Have a question or suggestion?</p>
            <Link href="/contact" className="bl-footer-contact-link">
              <Mail size={17} />
              Contact Us
              <ArrowUpRight size={15} />
            </Link>
          </div>

        </div>

        <div className="bl-footer-bottom">
          <p>© 2026 Babul Learn. All rights reserved.</p>
          <span>Made for smarter learning.</span>
        </div>
      </div>
    </footer>
  );
}
