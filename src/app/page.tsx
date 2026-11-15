import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <span className="font-display text-2xl tracking-tight text-foreground">
          LineUp
        </span>
        <Button asChild variant="outline" size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 pb-20 pt-8 sm:px-6">
        <p className="font-display text-5xl tracking-tight text-foreground sm:text-6xl md:text-7xl">
          LineUp
        </p>
        <h1 className="mt-4 max-w-xl text-2xl font-medium leading-snug text-foreground/90 sm:text-3xl">
          Make the lineup without the group-chat scramble.
        </h1>
        <p className="mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">
          Register for weekly games and club nights with ranks, waitlists, and
          capacity you can trust — English-first MVP.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/login">Get started</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/dashboard">Open dashboard</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
