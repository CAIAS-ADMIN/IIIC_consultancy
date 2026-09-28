"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Prints the record page as shown (the letterhead PDF is the separate "Download PDF" button). */
export function PrintButton() {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()}>
      <Printer className="h-4 w-4" aria-hidden />
      Print
    </Button>
  );
}
