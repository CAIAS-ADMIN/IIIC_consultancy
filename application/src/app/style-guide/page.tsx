"use client";

import * as React from "react";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { YesNoToggle } from "@/components/ui/yes-no-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Stepper } from "@/components/ui/stepper";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/use-toast";
import { STATUS_STYLES, type AnyStatus } from "@/lib/status";
import { Inbox } from "lucide-react";

const TOKEN_SWATCHES = [
  { name: "background", className: "bg-background" },
  { name: "card", className: "bg-card border border-border" },
  { name: "primary", className: "bg-primary" },
  { name: "primary-soft", className: "bg-primary-soft" },
  { name: "accent", className: "bg-accent" },
  { name: "accent-soft", className: "bg-accent-soft" },
  { name: "status-success", className: "bg-status-success-bg" },
  { name: "status-warning", className: "bg-status-warning-bg" },
  { name: "status-danger", className: "bg-status-danger-bg" },
  { name: "status-info", className: "bg-status-info-bg" },
  { name: "status-special", className: "bg-status-special-bg" },
  { name: "status-neutral", className: "bg-status-neutral-bg" },
];

type SampleRow = { id: string; client: string; department: string; status: AnyStatus; value: string };

const SAMPLE_ROWS: SampleRow[] = [
  { id: "CAIAS/CON/2026-27/014", client: "Verdant Analytics Pvt Ltd", department: "Computer Science", status: "active", value: "2,50,000" },
  { id: "CAIAS/CON/2026-27/013", client: "Northbridge Textiles", department: "Management Studies", status: "under_verification", value: "1,80,000" },
  { id: "CAIAS/CON/2026-27/009", client: "Hosa Robotics Labs", department: "Mechanical Engineering", status: "completed_closed", value: "3,10,000" },
];

const SAMPLE_COLUMNS: DataTableColumn<SampleRow>[] = [
  { header: "Consultancy ID", cell: (r) => r.id, primary: true },
  { header: "Client", cell: (r) => r.client },
  { header: "Department", cell: (r) => r.department },
  { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  { header: "Value (₹)", cell: (r) => r.value },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function ToastDemo() {
  const { toast } = useToast();
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => toast({ title: "Draft saved", variant: "success" })}>
        Trigger success toast
      </Button>
      <Button variant="secondary" onClick={() => toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" })}>
        Trigger error toast
      </Button>
    </div>
  );
}

export default function StyleGuidePage() {
  const [yesNo, setYesNo] = React.useState<boolean | null>(true);
  const [stepIndex, setStepIndex] = React.useState(1);

  // Dev-only route — not linked from any nav. Renders every Phase 0 primitive
  // so a visual check at 375px and 1440px covers the whole design system in
  // one place, per the frontend build plan's Phase 0 acceptance criteria.
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-12 p-6 md:p-10">
      <header className="flex items-center gap-4">
        {/* unoptimized: this file's extended-WebP (VP8X) header isn't parsed by Next's
            built-in image optimizer ("received null" on /_next/image) even though
            browsers render it fine directly — use `unoptimized` for this logo everywhere. */}
        <Image src="/brand/iiic-logo.webp" alt="IIIC logo" width={48} height={48} unoptimized />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Style Guide</h1>
          <p className="text-sm text-muted-foreground">
            Dev-only. Every Phase 0 primitive, for visual checks at 375px and 1440px.
          </p>
        </div>
      </header>

      <Section title="Tokens">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {TOKEN_SWATCHES.map((t) => (
            <div key={t.name} className="flex flex-col gap-1.5">
              <div className={`h-14 rounded-md ${t.className}`} />
              <span className="text-xs text-muted-foreground">{t.name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      <Section title="Form controls">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sg-input">Consultancy Title</Label>
            <Input id="sg-input" placeholder="e.g. AI-based Analytics Training Program" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sg-select">Department</Label>
            <Select defaultValue="cs">
              <SelectTrigger id="sg-select">
                <SelectValue placeholder="Select a department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cs">Computer Science</SelectItem>
                <SelectItem value="mgmt">Management Studies</SelectItem>
                <SelectItem value="bio">Biotechnology</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sg-textarea">Scope of Work</Label>
          <Textarea id="sg-textarea" placeholder="Briefly describe the scope and objectives of this consultancy" />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="sg-checkbox" defaultChecked />
          <Label htmlFor="sg-checkbox">I confirm the details above are accurate</Label>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Does this consultancy generate Intellectual Property?</Label>
          <YesNoToggle name="ip-generated" value={yesNo} onChange={setYesNo} />
        </div>
      </Section>

      <Section title="Stat tiles">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile label="Active" value={14} />
          <StatTile label="Pending Verification" value={5} tone="accent" />
          <StatTile label="Completed This Year" value={21} />
          <StatTile label="Total Value (₹)" value="86.4L" tone="primary" />
        </div>
      </Section>

      <Section title="Status badges (every backend enum value)">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STATUS_STYLES) as AnyStatus[]).map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </div>
      </Section>

      <Section title="Card">
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle>Active Institution-wide</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground">47</p>
          </CardContent>
        </Card>
      </Section>

      <Section title="Stepper">
        <Stepper
          steps={[{ label: "Client Details" }, { label: "Consultancy Details" }, { label: "Team & Agreement" }, { label: "Review & Submit" }]}
          currentIndex={stepIndex}
        />
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setStepIndex((i) => Math.max(0, i - 1))}>
            Back
          </Button>
          <Button size="sm" onClick={() => setStepIndex((i) => Math.min(3, i + 1))}>
            Next
          </Button>
        </div>
      </Section>

      <Section title="Data table (resize to <768px to see the mobile card list)">
        <DataTable columns={SAMPLE_COLUMNS} data={SAMPLE_ROWS} keyFor={(r) => r.id} />
      </Section>

      <Section title="Empty state">
        <EmptyState
          icon={Inbox}
          title="No consultancies yet"
          description="Once you create your first consultancy, it will show up here."
          action={<Button size="sm">+ New Consultancy</Button>}
        />
      </Section>

      <Section title="Skeleton">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-20 w-full" />
        </div>
      </Section>

      <Section title="Dialog (modal)">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Return for Clarification</DialogTitle>
              <DialogDescription>Select the fields that need correction and add a comment.</DialogDescription>
            </DialogHeader>
            <Textarea placeholder="Comments" />
            <DialogFooter>
              <Button variant="secondary">Cancel</Button>
              <Button>Return</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Section>

      <Section title="Sheet (mobile filter/notification panel)">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary">Open sheet</Button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetTitle>Filters</SheetTitle>
            <p className="text-sm text-muted-foreground">Sheet content goes here.</p>
          </SheetContent>
        </Sheet>
      </Section>

      <Section title="Toast">
        <ToastDemo />
      </Section>
    </div>
  );
}
