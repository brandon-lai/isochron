import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center text-foreground">
      <div className="max-w-md rounded-xl border border-border bg-scope-well p-8">
        <p className="text-sm font-medium text-primary tabular-nums">
          <span className="font-mono">404</span> Lost Beat
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">
          No timing station at this route
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Return to the main chronoscope bench to measure daily rate, balance
          amplitude, and beat error.
        </p>
        <div className="mt-6">
          <Link href="/" className={buttonVariants({ variant: "default" })}>
            Return to Isochron
          </Link>
        </div>
      </div>
      <footer className="mt-6 text-xs text-muted-foreground">
        <a
          href="https://github.com/brandon-lai/isochron"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Open source (GPLv2): Source &amp; C DSP
        </a>
      </footer>
    </main>
  );
}
