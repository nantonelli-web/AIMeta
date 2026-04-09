import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex-1 grid place-items-center px-6 py-20">
      <div className="text-center max-w-md space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-gold">
          ◆ MAIT · 404
        </p>
        <h1 className="text-4xl font-serif tracking-tight">
          Pagina non trovata.
        </h1>
        <p className="text-sm text-muted-foreground">
          La risorsa che stai cercando non esiste, è stata spostata o non hai i
          permessi per vederla.
        </p>
        <div className="pt-2 flex gap-2 justify-center">
          <Button asChild>
            <Link href="/dashboard">Torna alla dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
