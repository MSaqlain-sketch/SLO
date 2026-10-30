"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

export default function SiteNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const pathname = usePathname();
  

  function closeMenu() {
    setMobileMenuOpen(false);
  }

  return (
    <header className="home-navbar">
      <div className="home-nav-inner">
        <Link className="home-brand" href="/" aria-label="Babul Learn home">
          <Image
            src="/babul-learn-logo.png"
            alt=""
            width={42}
            height={42}
            priority
          />
          <span>Babul Learn</span>
        </Link>

        <button
          className="home-menu-button"
          type="button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>

        <nav
          className={`home-nav-links${mobileMenuOpen ? " is-open" : ""}`}
          aria-label="Main navigation"
        >
          

<Link
  href="/#home"
  className={pathname === "/" && activeSection === "home" ? "nav-active" : ""}
  onClick={() => {
    setActiveSection("home");
    closeMenu();
  }}
>
  Home
</Link>

<Link
  href="/#selector"
  className={pathname === "/" && activeSection === "selector" ? "nav-active" : ""}
  onClick={() => {
    setActiveSection("selector");
    closeMenu();
  }}
>
  Subjects
</Link>

<Link
  href="/past-papers"
  className={pathname === "/past-papers" ? "nav-active" : ""}
  onClick={closeMenu}
>
  Past Papers
</Link>

<Link
  href="/about"
  className={pathname === "/about" ? "nav-active" : ""}
  onClick={closeMenu}
>
  About
</Link>

<Link
  href="/contact"
  className={pathname === "/contact" ? "nav-active" : ""}
  onClick={closeMenu}
>
  Contact
</Link>


<div className="home-coming-soon-item">
  <span className="home-coming-soon-label">Coming Soon</span>
  <span
    className="home-coming-soon-link"
    aria-disabled="true"
  >
    Aptitude Test
  </span>
</div>


          <div className="home-mobile-nav-actions">
            <Link
              className="home-login-button"
              href="/login"
              onClick={closeMenu}
            >
              Log in
            </Link>
            <Link
              className="home-try-button"
              href="/#selector"
              onClick={closeMenu}
            >
              Try it free
            </Link>
          </div>
        </nav>

        <div className="home-nav-actions">
          <Link className="home-login-button" href="/login">Log in</Link>
          <Link className="home-try-button" href="/#selector">Try it free</Link>
        </div>
      </div>
    </header>
  );
}
