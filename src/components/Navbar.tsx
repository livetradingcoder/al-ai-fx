"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <nav className={`navbar ${scrolled ? "scrolled" : ""}`}>
        <div className="nav-container">
          <Link href="/" className="logo nav-brand" onClick={() => setIsOpen(false)}>
            <span className="nav-logo-mark" aria-hidden="true">
              <Image
                src="/favicon.png"
                alt=""
                width={38}
                height={38}
                sizes="38px"
              />
            </span>
            <span className="nav-brand-copy">
              <strong>GoldBot</strong>
              <span>by AL-ai-FX</span>
            </span>
          </Link>

          <div className="nav-links desktop-only">
            <Link href="/#features">Features</Link>
            <Link href="/#pricing">Pricing</Link>
            <Link href="/tutorials">Tutorials</Link>
            <Link href="/faq">FAQ</Link>
          </div>

          <div className="nav-actions desktop-only">
            <Link href="/login" className="btn-secondary nav-login">
              Login
            </Link>
            <Link href="/#pricing" className="btn-primary nav-cta">
              Get Access
            </Link>
          </div>

          <button
            type="button"
            className="nav-mobile-toggle mobile-only"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            aria-controls="mobile-nav-panel"
            aria-label={isOpen ? "Close navigation" : "Open navigation"}
          >
            {isOpen ? <X size={32} /> : <Menu size={32} />}
          </button>
        </div>
      </nav>

      {isOpen && (
        <div id="mobile-nav-panel" className="mobile-menu-panel">
          <div className="mobile-menu-shell">
            <Link href="/#features" onClick={() => setIsOpen(false)}>
              Features
            </Link>
            <Link href="/#pricing" onClick={() => setIsOpen(false)}>
              Pricing
            </Link>
            <Link href="/tutorials" onClick={() => setIsOpen(false)}>
              Tutorials
            </Link>
            <Link href="/faq" onClick={() => setIsOpen(false)}>
              FAQ
            </Link>
            <Link
              href="/login"
              onClick={() => setIsOpen(false)}
              className="btn-secondary mobile-menu-button"
            >
              Login
            </Link>
            <Link
              href="/#pricing"
              onClick={() => setIsOpen(false)}
              className="btn-primary mobile-menu-button"
            >
              Get Access
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
