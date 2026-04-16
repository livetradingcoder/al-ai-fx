"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <nav className="navbar">
        <div className="nav-container">
          <a href="/" className="logo" style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <img src="/favicon.png" alt="GoldBot Logo" style={{width: '32px', height: '32px'}} />
            GoldBot <span style={{fontSize: '0.8rem', fontWeight: 500, opacity: 0.8}}>by AL-ai-FX</span>
          </a>
          
          <div className="nav-links desktop-only">
            <a href="/#features">Features</a>
            <a href="/#pricing">Pricing</a>
            <a href="/tutorials">Tutorials</a>
            <a href="/faq">FAQ</a>
            <a href="/login" className="btn-secondary" style={{ marginLeft: '1rem' }}>Login</a>
          </div>

          <button 
            className="mobile-only" 
            onClick={() => setIsOpen(!isOpen)}
            style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: '0.5rem' }}
          >
            {isOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div 
          style={{
            position: 'fixed',
            top: '70px',
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--bg-primary)',
            zIndex: 999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: '2rem',
            gap: '2rem'
          }}
        >
          <a href="/#features" onClick={() => setIsOpen(false)} style={{ fontSize: '1.2rem', fontWeight: 500 }}>Features</a>
          <a href="/#pricing" onClick={() => setIsOpen(false)} style={{ fontSize: '1.2rem', fontWeight: 500 }}>Pricing</a>
          <a href="/tutorials" onClick={() => setIsOpen(false)} style={{ fontSize: '1.2rem', fontWeight: 500 }}>Tutorials</a>
          <a href="/faq" onClick={() => setIsOpen(false)} style={{ fontSize: '1.2rem', fontWeight: 500 }}>FAQ</a>
          <a href="/login" onClick={() => setIsOpen(false)} className="btn-primary" style={{ marginTop: '1rem', padding: '1rem 3rem' }}>Login to Dashboard</a>
        </div>
      )}
    </>
  );
}
