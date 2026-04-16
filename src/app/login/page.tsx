"use client";
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
      const res = await signIn("credentials", { 
        email, 
        password, 
        callbackUrl: "/dashboard",
        redirect: true 
      });
    } catch (err) {
      setError("An unexpected error occurred");
    }
  };

  return (
    <main className="main-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', textAlign: 'center' }}>Secure Login</h1>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '2rem' }}>Access your GoldBot Dashboard</p>
        
        {error && (
          <div style={{ 
            background: 'rgba(255, 68, 68, 0.1)', 
            border: '1px solid rgba(255, 68, 68, 0.2)', 
            color: '#ff4444', 
            padding: '1rem', 
            borderRadius: 'var(--radius-sm)', 
            marginBottom: '1.5rem',
            textAlign: 'center',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)', color: 'white', fontFamily: 'inherit'
              }}
              required 
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)', color: 'white', fontFamily: 'inherit'
              }}
              required 
            />
          </div>
          <button type="submit" className="btn-primary fill">Sign In</button>
          <div style={{ textAlign: "center", marginTop: "-0.5rem" }}>
            <a href="/forgot-password" style={{ color: "var(--text-muted)", fontSize: "0.85rem", textDecoration: "none" }}>
              Forgot Password?
            </a>
          </div>
        </form>
        <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Don't have an account? <a href="/#pricing" style={{ color: 'var(--accent-primary)' }}>Buy GoldBot</a>
        </p>
      </div>
    </main>
  );
}
