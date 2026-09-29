"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
} from "framer-motion";
import { ArrowRight, ChevronRight, Menu, X } from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";
import { Link } from "@/i18n/routing";
import "./landing-navbar.css";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function LandingNavbar() {
  const t = useTranslations("Navbar");
  const { data: session } = useSession();
  const reduceMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pricingActive, setPricingActive] = useState(false);

  const isLoggedIn = Boolean(session?.user?.id);
  const accountHref = isLoggedIn ? "/dashboard" : "/login";
  const accountLabel = isLoggedIn ? "Dashboard" : t("login");

  const links = [
    { href: "/features", label: t("features") },
    { href: "/catalog", label: t("robots") },
    { href: "/#pricing", label: t("pricing") },
    { href: "/tutorials", label: t("tutorials") },
    { href: "/faq", label: t("faq") },
    { href: "/affiliates", label: t("refer") },
  ];

  // Thin yellow bar along the bottom edge tracks reading progress.
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Pricing is a section on this page, so mark it active while in view.
  useEffect(() => {
    const target = document.getElementById("pricing");
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setPricingActive(entry.isIntersecting),
      { rootMargin: "-40% 0px -50% 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  const close = () => setIsOpen(false);

  return (
    <>
      <motion.header
        className={`lnav ${scrolled ? "is-scrolled" : ""} ${isOpen ? "is-open" : ""}`}
        initial={reduceMotion ? false : { y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <nav className="lnav-inner" aria-label="Main">
          <Link href="/" className="lnav-brand" onClick={close}>
            <span className="lnav-logo" aria-hidden="true">
              <Image src="/favicon.png" alt="" width={36} height={36} sizes="36px" />
            </span>
            <span className="lnav-brand-copy">
              <strong>{t("brandPrefix")}</strong>
              <span>{t("brandSuffix")}</span>
            </span>
          </Link>

          <ul className="lnav-links" onMouseLeave={() => setHovered(null)}>
            {links.map((link) => {
              const active = link.href === "/#pricing" && pricingActive;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`lnav-link ${active ? "is-active" : ""}`}
                    onMouseEnter={() => setHovered(link.href)}
                    onFocus={() => setHovered(link.href)}
                    aria-current={active ? "true" : undefined}
                  >
                    {hovered === link.href && (
                      <motion.span
                        layoutId="lnav-hover"
                        className="lnav-hover"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className="lnav-link-label">{link.label}</span>
                    {active && (
                      <motion.span layoutId="lnav-active" className="lnav-active-bar" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="lnav-actions">
            <span className="lnav-lang">
              <LanguageSwitcher />
            </span>
            <span className="lnav-divider" aria-hidden="true" />
            <Link href={accountHref} className="lnav-login">
              {accountLabel}
            </Link>
            <Link href="/#pricing" className="lnav-cta">
              {t("getAccess")}
              <ArrowRight size={15} />
            </Link>
          </div>

          <button
            type="button"
            className="lnav-toggle"
            onClick={() => setIsOpen((open) => !open)}
            aria-expanded={isOpen}
            aria-controls="lnav-sheet"
            aria-label={isOpen ? "Close navigation" : "Open navigation"}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={isOpen ? "close" : "open"}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {isOpen ? <X size={22} /> : <Menu size={22} />}
              </motion.span>
            </AnimatePresence>
          </button>
        </nav>

        <motion.span
          className="lnav-progress"
          style={{ scaleX: progress }}
          aria-hidden="true"
        />
      </motion.header>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="lnav-sheet"
            className="lnav-sheet"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.ul
              className="lnav-sheet-links"
              initial="hidden"
              animate="show"
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
              }}
            >
              {links.map((link) => (
                <motion.li
                  key={link.href}
                  variants={{
                    hidden: { opacity: 0, x: -16 },
                    show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: EASE } },
                  }}
                >
                  <Link href={link.href} onClick={close}>
                    {link.label}
                    <ChevronRight size={18} aria-hidden="true" />
                  </Link>
                </motion.li>
              ))}
            </motion.ul>

            <motion.div
              className="lnav-sheet-foot"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2, ease: EASE }}
            >
              <span className="lnav-lang">
                <LanguageSwitcher placement="up" />
              </span>
              <Link href={accountHref} onClick={close} className="lnav-sheet-login">
                {accountLabel}
              </Link>
              <Link href="/#pricing" onClick={close} className="lnav-sheet-cta">
                {t("getAccess")}
                <ArrowRight size={16} />
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
