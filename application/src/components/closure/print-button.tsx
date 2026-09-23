"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Browser Print -> Save as PDF is the actual export mechanism for the Closure Record (see the page's own note on why). */
export function PrintButton() {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()}>
      <Printer className="h-4 w-4" aria-hidden />
      Print / Save as PDF
    </Button>
  );
}
