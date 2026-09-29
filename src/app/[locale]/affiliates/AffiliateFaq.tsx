"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

export default function AffiliateFaq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="af-faq">
      {items.map((item, index) => {
        const isOpen = open === index;
        return (
          <div key={item.q} className={`af-faq-item ${isOpen ? "is-open" : ""}`}>
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`af-faq-${index}`}
                onClick={() => setOpen(isOpen ? null : index)}
              >
                <span>{item.q}</span>
                <ChevronDown size={18} aria-hidden="true" />
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={`af-faq-${index}`}
                  role="region"
                  className="af-faq-answer"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p>{item.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
