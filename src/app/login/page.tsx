"use client";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await signIn("credentials", { 
        email, 
        password, 
        callbackUrl: "/dashboard",
        redirect: true 
      });
    } catch {
      setError("An unexpected error occurred");
    }
  };

  return (
    <main className="main-content" style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, rgba(245, 158, 11, 0.08) 0%, transparent 50%), radial-gradient(ellipse at bottom, rgba(41, 98, 255, 0.06) 0%, transparent 50%)'
    }}>
      <div className="card-glass" style={{ width: '100%', maxWidth: '480px', padding: '48px 40px' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.75rem', textAlign: 'center', fontWeight: 800 }}>Secure Login</h1>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '2.5rem', fontSize: '1.05rem' }}>Access your GoldBot Dashboard</p>
        
        {error && (
          <div style={{ 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '2px solid rgba(239, 68, 68, 0.3)', 
            color: '#ef4444', 
            padding: '1.25rem', 
            borderRadius: 'var(--radius-md)', 
            marginBottom: '2rem',
            textAlign: 'center',
            fontSize: '0.95rem',
            fontWeight: 600
          }}>
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 600 }}>Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              placeholder="your@email.com"
              required 
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 600 }}>Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              placeholder="••••••••"
              required 
            />
          </div>
          <button type="submit" className="btn-primary fill" style={{ marginTop: '0.5rem' }}>Sign In</button>
          <div style={{ textAlign: "center", marginTop: "-0.75rem" }}>
            <Link href="/forgot-password" style={{ color: "var(--text-secondary)", fontSize: "0.95rem", textDecoration: "none", transition: 'color 0.2s' }}>
              Forgot Password?
            </Link>
          </div>
        </form>
        <p style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.95rem', color: 'var(--text-muted)' }}>
          Don&apos;t have an account? <Link href="/#pricing" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Buy GoldBot</Link>
        </p>
      </div>
    </main>
  );
}
