import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Coffee, Copy, ExternalLink, Heart, QrCode, Sparkles, Star, Zap } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";

const SAWERIA_URL = "https://saweria.co/nannndev";
const BUYMEACOFFEE_URL = "https://buymeacoffee.com/ekaprasety8";

function SaweriaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  );
}

export default function Donate() {
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [coffees, setCoffees] = useState(3);

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedLink(label);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  return (
    <div className="workspace-shell min-h-screen bg-background transition-colors duration-300">
      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
        <Link to="/" className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to typing
        </Link>

        {/* Header Section */}
        <header className="mb-10 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <Heart className="size-3.5 fill-current" /> Support Open Source
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Support Codey</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Codey is 100% free and open-source. If this app helps you improve your typing speed or developer workflow, consider supporting the developer to keep hosting & cloud features alive!
          </p>
        </header>

        {/* Donation Platforms Section */}
        <main className="animate-fade-in-up space-y-8">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Saweria Card */}
            <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-amber-500/20 bg-card/90 p-6 shadow-sm backdrop-blur-sm transition-all hover:border-amber-500/40 hover:shadow-md">
              <div className="absolute -right-12 -top-12 size-36 rounded-full bg-amber-500/10 blur-2xl transition-all group-hover:bg-amber-500/20" />
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid size-12 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      <SaweriaIcon className="size-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Saweria</h2>
                      <p className="text-xs text-muted-foreground">Local Indonesia (QRIS / E-Wallet)</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    IDR / QRIS
                  </span>
                </div>

                <p className="mt-4 text-xs text-muted-foreground sm:text-sm">
                  Support via <strong>QRIS, GoPay, OVO, DANA, LinkAja, ShopeePay</strong>, or Bank Transfer. Display messages & overlay while streaming/typing!
                </p>

                {/* Preset Nominal */}
                <div className="mt-5 space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Preset Amounts</p>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    {["Rp 10k", "Rp 25k", "Rp 50k", "Rp 100k"].map((amount) => (
                      <a
                        key={amount}
                        href={SAWERIA_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border bg-muted/40 py-2 font-semibold text-foreground transition-colors hover:border-amber-500/50 hover:bg-amber-500/10"
                      >
                        {amount}
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-2 pt-4 border-t border-border/50">
                <Button asChild className="flex-1 bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400">
                  <a href={SAWERIA_URL} target="_blank" rel="noopener noreferrer">
                    <QrCode className="size-4" />
                    <span>Saweria Page</span>
                    <ExternalLink className="size-3.5 opacity-70" />
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(SAWERIA_URL, "saweria")}
                  title="Copy Saweria link"
                >
                  {copiedLink === "saweria" ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>

            {/* Buy Me a Coffee Card */}
            <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-amber-400/20 bg-card/90 p-6 shadow-sm backdrop-blur-sm transition-all hover:border-amber-400/40 hover:shadow-md">
              <div className="absolute -right-12 -top-12 size-36 rounded-full bg-yellow-500/10 blur-2xl transition-all group-hover:bg-yellow-500/20" />
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid size-12 place-items-center rounded-xl bg-yellow-500/15 text-yellow-600 dark:text-yellow-400">
                      <Coffee className="size-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Buy Me a Coffee</h2>
                      <p className="text-xs text-muted-foreground">Global (Credit Card / PayPal)</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-yellow-500/10 px-2.5 py-1 text-[10px] font-bold text-yellow-600 dark:text-yellow-400">
                    USD / International
                  </span>
                </div>

                <p className="mt-4 text-xs text-muted-foreground sm:text-sm">
                  Support via <strong>Credit Card, PayPal, Apple Pay, Google Pay</strong>. Buy a coffee (or a few!) to keep the project energised.
                </p>

                {/* Interactive Coffee Counter */}
                <div className="mt-5 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    <span>Coffee Count</span>
                    <span className="font-bold text-foreground">${coffees * 3} USD</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-1.5">
                    {[1, 3, 5, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setCoffees(num)}
                        className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                          coffees === num
                            ? "bg-yellow-500 text-slate-950 shadow"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <Coffee className="size-3.5" />
                        <span>{num}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-2 pt-4 border-t border-border/50">
                <Button asChild className="flex-1 bg-yellow-400 font-semibold text-slate-950 hover:bg-yellow-300">
                  <a href={`${BUYMEACOFFEE_URL}`} target="_blank" rel="noopener noreferrer">
                    <Coffee className="size-4" />
                    <span>Buy {coffees} {coffees === 1 ? "Coffee" : "Coffees"} (${coffees * 3})</span>
                    <ExternalLink className="size-3.5 opacity-70" />
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(BUYMEACOFFEE_URL, "bmac")}
                  title="Copy Buy Me a Coffee link"
                >
                  {copiedLink === "bmac" ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Alternative Ways to Support */}
          <section className="rounded-2xl border bg-card/80 p-6 backdrop-blur-sm">
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <Sparkles className="size-5 text-amber-500" />
              <span>Other Ways to Support</span>
            </h3>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Don't have funds? No problem! You can support Codey in many impactful ways:
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border bg-muted/30 p-4">
                <Star className="mb-2 size-5 text-amber-400 fill-amber-400/20" />
                <h4 className="text-sm font-bold">Star on GitHub</h4>
                <p className="mt-1 text-xs text-muted-foreground">Give the project repository a star to increase visibility.</p>
                <a
                  href="https://github.com/nannndev/codetype"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-500 hover:underline"
                >
                  Star Repo <ExternalLink className="size-3" />
                </a>
              </div>

              <div className="rounded-xl border bg-muted/30 p-4">
                <Zap className="mb-2 size-5 text-blue-400" />
                <h4 className="text-sm font-bold">Share with Developers</h4>
                <p className="mt-1 text-xs text-muted-foreground">Tell your tech friends, dev communities, or colleagues about Codey.</p>
                <button
                  type="button"
                  onClick={() => copyToClipboard(window.location.origin, "share")}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-500 hover:underline"
                >
                  {copiedLink === "share" ? "Copied Link!" : "Copy App Link"}
                </button>
              </div>

              <div className="rounded-xl border bg-muted/30 p-4">
                <Heart className="mb-2 size-5 text-rose-400" />
                <h4 className="text-sm font-bold">Contribute Code</h4>
                <p className="mt-1 text-xs text-muted-foreground">Submit new code snippets, fix bugs, or build new features.</p>
                <Link to="/contributors" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-rose-500 hover:underline">
                  View Contributors &rarr;
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
      <Footer />
    </div>
  );
}
