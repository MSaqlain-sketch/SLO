import Image from "next/image";
import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="home-footer">
      <Link className="home-brand" href="/" aria-label="Babul Learn home">
        <Image src="/babul-learn-logo.png" alt="" width={34} height={34} />
        <span>Babul Learn</span>
      </Link>
      <p>Study with clarity. Learn with confidence.</p>
      <Link href="/contact">Contact us</Link>
    </footer>
  );
}
