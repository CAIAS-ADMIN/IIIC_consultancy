"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit2, CheckCircle2, XCircle, History, Database, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { FilterInput } from "@/components/ui/filter-input";
import { matchesQuery } from "@/lib/search";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { apiErrorMessage } from "@/lib/api-error";

export type MasterDataItem = {
  id: string;
  category: string;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
};

export type AuditEventItem = {
  id: string;
  entityId: string;
  action: string;
  actor: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  createdAt: string;
};

/** Friendly names for the categories seeded today; any other category (added later) falls back to a humanized code. */
const CATEGORY_LABELS: Record<string, string> = {
  consultancy_area: "Consultancy Areas",
  consultancy_type: "Consultancy Types",
  team_type: "Team Types",
  organization_type: "Organization Types",
  agreement_type: "Agreement Types",
  payment_terms: "Payment Terms",
  payment_mode: "Payment Modes",
  currency: "Currencies",
  academic_year: "Academic Years",
  document_type: "Document Types",
};

const AUDITED_FIELDS = ["category", "code", "label", "sortOrder", "isActive"] as const;

function categoryLabel(category: string) {
  return CATEGORY_LABELS[category] ?? category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

type FormState = { code: string; label: string; sortOrder: string; isActive: boolean };
const EMPTY_FORM: FormState = { code: "", label: "", sortOrder: "0", isActive: true };

export function MasterDataHub({ items, auditLogs }: { items: MasterDataItem[]; auditLogs: AuditEventItem[] }) {
  const router = useRouter();
  const { toast } = useToast();

  const categories = React.useMemo(
    () => [...new Set(items.map((i) => i.category))].sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b))),
    [items]
  );
  const [selectedCategory, setSelectedCategory] = React.useState(categories[0] ?? "");
  const [activeTab, setActiveTab] = React.useState<"items" | "audit">("items");

  // `null` = closed, `"new"` = add dialog, otherwise the row being edited.
  const [dialog, setDialog] = React.useState<MasterDataItem | "new" | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<MasterDataItem | null>(null);
  const [deleteBlocked, setDeleteBlocked] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const [filter, setFilter] = React.useState("");
  const categoryItems = items.filter((i) => i.category === selectedCategory);
  const filteredItems = categoryItems.filter((i) => matchesQuery(filter, i.label, i.code));
  const itemLabelById = React.useMemo(() => new Map(items.map((i) => [i.id, `${categoryLabel(i.category)} · ${i.label}`])), [items]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setDialog("new");
  };

  const openEdit = (item: MasterDataItem) => {
    setForm({ code: item.code, label: item.label, sortOrder: String(item.sortOrder), isActive: item.isActive });
    setDialog(item);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dialog) return;
    const isNew = dialog === "new";
    if (!form.label.trim() || (isNew && !form.code.trim())) {
      toast({ title: "Missing fields", description: "Code and label are required.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(isNew ? "/api/master-data" : `/api/master-data/${dialog.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(isNew ? { category: selectedCategory, code: form.code.trim().toLowerCase().replace(/\s+/g, "_") } : {}),
          label: form.label.trim(),
          sortOrder: parseInt(form.sortOrder, 10) || 0,
          isActive: form.isActive,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(apiErrorMessage(json, `Could not save (${res.status})`));

      toast({ title: isNew ? "Item added" : "Item updated", description: form.label.trim(), variant: "success" });
      setDialog(null);
      router.refresh();
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "Could not save.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleActive = async (item: MasterDataItem) => {
    setTogglingId(item.id);
    try {
      const res = await fetch(`/api/master-data/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(apiErrorMessage(json, `Could not update (${res.status})`));
      toast({ title: item.isActive ? "Deactivated" : "Activated", description: item.label, variant: "success" });
      router.refresh();
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : "Could not update.", variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  };

  const openDelete = (item: MasterDataItem) => {
    setDeleteBlocked(null);
    setDeleting(item);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/master-data/${deleting.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409) {
        // In use — explain where, and offer Deactivate instead.
        setDeleteBlocked(apiErrorMessage(json, "This value is in use and can't be deleted."));
        return;
      }
      if (!res.ok) throw new Error(apiErrorMessage(json, `Could not delete (${res.status})`));
      toast({ title: "Deleted", description: deleting.label, variant: "success" });
      setDeleting(null);
      router.refresh();
    } catch (err) {
      toast({ title: "Delete failed", description: err instanceof Error ? err.message : "Could not delete.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: DataTableColumn<MasterDataItem>[] = [
    { header: "Label", cell: (r) => <span className="font-medium text-foreground">{r.label}</span>, primary: true },
    { header: "Code", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.code}</span> },
    { header: "Order", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.sortOrder}</span> },
    {
      header: "Status",
      cell: (r) => (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
            r.isActive ? "bg-status-success-bg text-status-success-fg" : "bg-status-neutral-bg text-status-neutral-fg"
          }`}
        >
          {r.isActive ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : <XCircle className="h-3 w-3" aria-hidden />}
          {r.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      header: "Actions",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => openEdit(r)} className="gap-1" aria-label={`Edit ${r.label}`}>
            <Edit2 className="h-3.5 w-3.5" aria-hidden /> Edit
          </Button>
          <Button variant="ghost" size="sm" disabled={togglingId === r.id} onClick={() => toggleActive(r)}>
            {r.isActive ? "Deactivate" : "Activate"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openDelete(r)}
            className="gap-1 text-status-danger-fg"
            aria-label={`Delete ${r.label}`}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
          </Button>
        </div>
      ),
    },
  ];

  const isNew = dialog === "new";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <div role="tablist" aria-label="Master data sections" className="flex items-center gap-2">
          <Button role="tab" aria-selected={activeTab === "items"} size="sm" variant={activeTab === "items" ? "primary" : "secondary"} onClick={() => setActiveTab("items")}>
            Dropdown Values
          </Button>
          <Button
            role="tab"
            aria-selected={activeTab === "audit"}
            size="sm"
            variant={activeTab === "audit" ? "primary" : "secondary"}
            onClick={() => setActiveTab("audit")}
            className="gap-1.5"
          >
            <History className="h-3.5 w-3.5" aria-hidden />
            Audit Log
          </Button>
        </div>
        {activeTab === "items" && selectedCategory && (
          <Button size="sm" onClick={openAdd} className="gap-1.5">
            <Plus className="h-4 w-4" aria-hidden /> Add
          </Button>
        )}
      </div>

      {activeTab === "items" ? (
        categories.length === 0 ? (
          <EmptyState icon={Database} title="No master data yet" description="Run the master-data seed to populate the dropdown categories." />
        ) : (
          <div className="grid gap-6 md:grid-cols-4">
            {/* Categories: horizontal scroll strip on mobile, vertical list on desktop */}
            <nav aria-label="Categories" className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:px-0">
              {categories.map((c) => {
                const selected = c === selectedCategory;
                return (
                  <button
                    key={c}
                    onClick={() => {
                      setSelectedCategory(c);
                      setFilter("");
                    }}
                    aria-current={selected ? "true" : undefined}
                    className={`flex min-h-11 shrink-0 items-center justify-between gap-3 rounded-md px-3 text-sm font-medium transition-colors ${
                      selected ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-background hover:text-foreground"
                    }`}
                  >
                    <span>{categoryLabel(c)}</span>
                    <span className="rounded-full border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">
                      {items.filter((i) => i.category === c).length}
                    </span>
                  </button>
                );
              })}
            </nav>

            <Card className="md:col-span-3">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">{categoryLabel(selectedCategory)}</CardTitle>
                <p className="font-mono text-xs text-muted-foreground">{selectedCategory}</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {categoryItems.length > 0 && (
                  <FilterInput
                    id="master-data-filter"
                    label={`Search ${categoryLabel(selectedCategory)}`}
                    placeholder="Search label or code"
                    value={filter}
                    onChange={setFilter}
                  />
                )}
                <DataTable
                  columns={columns}
                  data={filteredItems}
                  keyFor={(r) => r.id}
                  emptyState={
                    filter.trim() && categoryItems.length > 0 ? (
                      <EmptyState title="No matches" description={`No value in this category matches “${filter.trim()}”.`} />
                    ) : (
                      <EmptyState title="No values in this category" description="Add the first value with the Add button." />
                    )
                  }
                />
              </CardContent>
            </Card>
          </div>
        )
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Master Data Audit Log</CardTitle>
            <p className="text-xs text-muted-foreground">Latest 50 changes, newest first.</p>
          </CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <EmptyState icon={History} title="No changes recorded yet" />
            ) : (
              <ol className="flex flex-col gap-3">
                {auditLogs.map((log) => {
                  const changed = AUDITED_FIELDS.filter((f) =>
                    log.action === "created" ? log.newValue?.[f] !== undefined : log.oldValue?.[f] !== log.newValue?.[f]
                  );
                  const subject =
                    (log.newValue?.label as string | undefined) ?? itemLabelById.get(log.entityId) ?? (log.oldValue?.label as string | undefined) ?? log.entityId;
                  return (
                    <li key={log.id} className="flex flex-col gap-2 rounded-md border border-border p-3 text-xs">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="text-sm font-semibold text-foreground">
                          <span className="capitalize">{log.action}</span> · {subject}
                        </span>
                        <time dateTime={log.createdAt} className="text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString("en-IN")}
                        </time>
                      </div>
                      <p className="text-muted-foreground">by {log.actor}</p>
                      {changed.length > 0 && (
                        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-border pt-2">
                          {changed.map((f) => (
                            <React.Fragment key={f}>
                              <dt className="font-medium text-muted-foreground">{f}</dt>
                              <dd className="break-words text-foreground">
                                {log.action === "created" ? (
                                  formatValue(log.newValue?.[f])
                                ) : (
                                  <>
                                    <span className="text-status-danger-fg line-through">{formatValue(log.oldValue?.[f])}</span>
                                    {" → "}
                                    <span className="text-status-success-fg">{formatValue(log.newValue?.[f])}</span>
                                  </>
                                )}
                              </dd>
                            </React.Fragment>
                          ))}
                        </dl>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isNew ? "Add value" : "Edit value"}</DialogTitle>
            <DialogDescription>{categoryLabel(isNew ? selectedCategory : (dialog?.category ?? ""))}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="md-code">Code</Label>
              <Input
                id="md-code"
                placeholder="e.g. machine_learning"
                value={form.code}
                disabled={!isNew}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                className="font-mono"
              />
              {!isNew && <p className="text-xs text-muted-foreground">Codes are stored on existing records, so they can&apos;t be changed.</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="md-label">Label</Label>
              <Input id="md-label" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="md-sort">Sort order</Label>
              <Input
                id="md-sort"
                type="number"
                inputMode="numeric"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="md-active" checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v === true }))} />
              <Label htmlFor="md-active">Active (shown in dropdowns)</Label>
            </div>
            <DialogFooter className="mt-2">
              <Button type="button" variant="secondary" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : isNew ? "Add" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{deleteBlocked ? "Can't delete this value" : "Delete this value?"}</DialogTitle>
            <DialogDescription>
              {deleting && (
                <>
                  <span className="font-medium text-foreground">{deleting.label}</span>{" "}
                  <span className="font-mono text-xs">({deleting.code})</span> · {categoryLabel(deleting.category)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {deleteBlocked ? (
            <p role="alert" className="rounded-md border border-status-warning-fg/30 bg-status-warning-bg p-3 text-sm text-status-warning-fg">
              {deleteBlocked}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              It will be removed from every dropdown permanently. Values already used on a consultancy can&apos;t be deleted — you&apos;ll be told
              where it&apos;s used and can deactivate it instead.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setDeleting(null)}>
              {deleteBlocked ? "Close" : "Cancel"}
            </Button>
            {deleteBlocked ? (
              deleting?.isActive && (
                <Button
                  type="button"
                  disabled={togglingId === deleting.id}
                  onClick={async () => {
                    await toggleActive(deleting);
                    setDeleting(null);
                  }}
                >
                  Deactivate instead
                </Button>
              )
            ) : (
              <Button type="button" variant="destructive" disabled={isDeleting} onClick={confirmDelete}>
                {isDeleting ? "Deleting…" : "Delete"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
