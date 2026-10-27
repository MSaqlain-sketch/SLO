"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Check,
  Copy,
  Mail,
  MapPin,
  Send,
  User,
} from "lucide-react";
import SiteFooter from "../../components/site-footer";
import SiteNavbar from "../../components/site-navbar";

const CONTACT_EMAIL = "BabulLearn@gmail.com";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const copiedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
  }, []);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setCopied(true);
      if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
      copiedTimeout.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Unable to copy the email address. Please select it to copy.");
    }
  }

  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName || !trimmedEmail || !trimmedMessage) {
      setError("Please fill in your name, email and message.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setError("");
    const subject = encodeURIComponent(`Message from ${trimmedName}`);
    const body = encodeURIComponent(
      `${trimmedMessage}\n\nFrom: ${trimmedName}\nEmail: ${trimmedEmail}`,
    );
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  }

  return (
    <div className="babul-home info-page">
      <SiteNavbar />
      <main className="contact-main">
        <section className="contact-heading">
          <h1 className="info-heading">
            Get in <span>touch</span>
          </h1>
          <p>Questions, feedback or ideas? We would love to hear from you.</p>
        </section>

        <div className="contact-grid">
          <section className="contact-info-list" aria-label="Contact information">
            <article className="contact-info-card">
              <span className="contact-icon-tile" aria-hidden="true">
                <User size={24} strokeWidth={2} />
              </span>
              <div>
                <h2>Co-Founder</h2>
                <p>Muhammad Saqlain</p>
              </div>
            </article>

            <article className="contact-info-card">
              <span className="contact-icon-tile" aria-hidden="true">
                <Mail size={24} strokeWidth={2} />
              </span>
              <div className="contact-email-content">
                <h2>Email</h2>
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
              </div>
              <button
                className="contact-copy-button"
                type="button"
                onClick={() => void copyEmail()}
                aria-label={copied ? "Email copied" : "Copy email address"}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </article>

            <article className="contact-info-card">
              <span className="contact-icon-tile" aria-hidden="true">
                <MapPin size={24} strokeWidth={2} />
              </span>
              <div>
                <h2>Location</h2>
                <p>Karachi, Pakistan</p>
              </div>
            </article>
          </section>

          <section className="contact-form-card" aria-label="Contact form">
            <form onSubmit={submitMessage} noValidate>
              <label className="contact-field">
                <span>Name</span>
                <input
                  type="text"
                  name="name"
                  autoComplete="name"
                  placeholder="M.Saqlain"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </label>
              <label className="contact-field">
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="BabulLearn@gmail.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
              <label className="contact-field">
                <span>Message</span>
                <textarea
                  name="message"
                  rows={5}
                  placeholder="I have a question about AKU-EB study materials."
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  required
                />
              </label>
              {error && (
                <p className="contact-inline-error" role="alert">
                  {error}
                </p>
              )}
              <button className="contact-send-button" type="submit">
                Send message
                <Send size={17} strokeWidth={2} />
              </button>
            </form>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
