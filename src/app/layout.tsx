import './globals.css';
import Navbar from "../components/Navbar";

export const metadata = {
  title: 'GoldBot by AL-ai-FX | Advanced Algorithmic Trading',
  description: 'Automate your MT5 trading with GoldBot by AL-ai-FX. Subscribe, customize, and compile your exclusive Expert Advisor directly from our cloud service.',
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        {children}
        <footer className="footer">
          <div className="footer-grid">
            <div>
              <h4>GoldBot by AL-ai-FX</h4>
              <p>Algorithmic tooling for MT5 automation workflows and account-specific deployment.</p>
            </div>
            <div>
              <h4>Legal</h4>
              <div className="footer-links">
                <a href="/privacy-policy">Privacy Policy</a>
                <a href="/terms-conditions">Terms & Conditions</a>
                <a href="/refund-policy">Refund Policy</a>
                <a href="/disclaimer">Disclaimer</a>
              </div>
            </div>
          </div>
          <p className="footer-note">&copy; {new Date().getFullYear()} AL-ai-FX Algorithms. GoldBot is a trademark of AL-ai-FX. Trading carries risk and past performance does not guarantee future results. See Disclaimer, Privacy Policy, Terms & Conditions, and Refund Policy.</p>
        </footer>
      </body>
    </html>
  );
}
