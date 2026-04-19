"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface LicenseManagerProps {
  subscription: {
    id: string;
    tier: string;
    mt5AccountNumber: string | null;
    status: string;
  };
  latestCompilation: {
    id: string;
    status: string;
    downloadUrl: string | null;
    updatedAt: string | Date;
  } | null;
}

export default function LicenseManager({ subscription, latestCompilation: initialCompilation }: LicenseManagerProps) {
  const [mt5Account, setMt5Account] = useState(subscription.mt5AccountNumber || "");
  const [isEditing, setIsEditing] = useState(!subscription.mt5AccountNumber);
  const [isUpdating, setIsUpdating] = useState(false);
  const [compilation, setCompilation] = useState(initialCompilation);
  const [isPolling, setIsPolling] = useState(initialCompilation?.status === "PENDING" || initialCompilation?.status === "PROCESSING");
  const router = useRouter();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPolling && compilation?.id) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/licenses/status?jobId=${compilation.id}`);
          const data = await res.json();
          if (data.status === "COMPLETED" || data.status === "FAILED") {
            setCompilation(data);
            setIsPolling(false);
            router.refresh(); // Update the whole page state
          }
        } catch (error) {
          console.error("Polling error:", error);
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isPolling, compilation?.id, router]);

  const handleUpdateMt5 = async () => {
    if (!mt5Account) return;
    setIsUpdating(true);
    try {
      const res = await fetch("/api/licenses/update-mt5", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: subscription.id, mt5AccountNumber: mt5Account }),
      });
      const data = await res.json();
      if (data.success) {
        setIsEditing(false);
        setCompilation(data.job);
        setIsPolling(true);
        router.refresh();
      } else {
        alert(data.error || "Failed to update MT5 account.");
      }
    } catch {
      alert("Error updating MT5 account.");
    } finally {
      setIsUpdating(false);
    }
  };

  const statusColor = compilation?.status === "COMPLETED" ? "var(--accent-accent)" :
    compilation?.status === "FAILED" ? "#ff4444" : "var(--accent-primary)";

  return (
    <div className="glass-panel" style={{ marginBottom: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "1rem" }}>
        <div>
          <h3 style={{ fontSize: "1.2rem", color: "var(--text-primary)" }}>GoldBot_v2.0_{subscription.tier}</h3>
          <p style={{ color: "var(--accent-primary)", fontSize: "0.9rem", fontWeight: 600 }}>{subscription.tier.replace("_", " ")} Access</p>
        </div>
        <div>
          <span className="badge" style={{ position: "relative", top: 0, left: 0, transform: "none", background: "var(--accent-accent)" }}>{subscription.status}</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
        <div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Locked MT5 Account</p>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <input
              type="text"
              value={mt5Account}
              onChange={(e) => setMt5Account(e.target.value)}
              disabled={!isEditing}
              placeholder="Enter MT5 Account ID"
              style={{
                padding: "0.8rem",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-color)",
                background: "rgba(0,0,0,0.2)",
                color: "var(--text-primary)",
                fontFamily: "inherit",
                width: "100%",
              }}
            />
            {isEditing && (
              <button className="btn-primary" onClick={handleUpdateMt5} disabled={isUpdating}>
                {isUpdating ? "Saving..." : "Save & Lock"}
              </button>
            )}
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
            {isEditing ? "Important: You can only set this number once. It cannot be changed later." : "MT5 account is permanently locked for this license."}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Download Latest Build</p>

          {compilation?.status === "COMPLETED" && compilation.id ? (
            <a
              href={`/api/compiler/download?jobId=${compilation.id}`}
              download
              className="btn-primary"
              style={{ textAlign: "center", textDecoration: "none" }}
            >
              Download Latest .ex5
            </a>
          ) : (
            <button
              className="btn-primary"
              disabled={isPolling || !mt5Account || isEditing}
              style={{ border: "none", alignSelf: "flex-start", opacity: (isPolling || !mt5Account || isEditing) ? 0.6 : 1 }}
              onClick={handleUpdateMt5}
            >
              {isPolling ? `Compiling... (${compilation?.status})` : "Compile & Download .ex5"}
            </button>
          )}

          {compilation && (
            <p style={{ fontSize: "0.8rem", color: statusColor, marginTop: "0.5rem", fontWeight: 500 }}>
              Status: {compilation.status}
              {compilation.status === "FAILED" && " - Check dashboard again later."}
            </p>
          )}
        </div>
      </div>

      {compilation?.status === "COMPLETED" && (
        <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <h4 style={{ color: 'var(--accent-accent)', marginBottom: '1rem', fontSize: '1rem' }}>✅ Compilation Successful! Next Steps:</h4>
          <ul style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', paddingLeft: '1.2rem' }}>
            <li><strong>Step 1:</strong> Download the <code>.ex5</code> file above.</li>
            <li><strong>Step 2:</strong> Open your MT5 Terminal, go to <code>File  `{'>'}` Open Data Folder</code>.</li>
            <li><strong>Step 3:</strong> Navigate to <code>MQL5  `{'>'}` Experts</code> and paste the file there.</li>
            <li><strong>Step 4:</strong> Refresh the "Experts" list in your MT5 Navigator and drag the robot onto an XAUUSD chart.</li>
            <li><strong>Step 5:</strong> In the inputs, ensure you set your <strong>Risk Percent</strong> and <strong>Trading Hours</strong> as per the PDF guide.</li>
          </ul>
          <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            ⚠️ Note: This build is locked to MT5 Account <strong>{subscription.mt5AccountNumber}</strong>. It will not execute on any other account number.
          </p>
        </div>
      )}
    </div>
  );
}
