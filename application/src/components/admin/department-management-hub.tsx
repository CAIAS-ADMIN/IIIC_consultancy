"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit2, Trash2, CheckCircle2, XCircle, AlertTriangle, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { FilterInput } from "@/components/ui/filter-input";
import { matchesQuery } from "@/lib/search";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

export type DepartmentRow = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  consultancyCount: number;
};

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(typeof json.error === "string" ? json.error : `Request failed (${res.status})`), {
      canDeactivate: json.canDeactivate === true,
    });
  }
  return json;
}

export function DepartmentManagementHub({ departments, canManage }: { departments: DepartmentRow[]; canManage: boolean }) {
  const router = useRouter();
  const { toast } = useToast();

  // `null` = closed, `"new"` = add dialog, otherwise the row being edited.
  const [editing, setEditing] = React.useState<DepartmentRow | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<DepartmentRow | null>(null);
  const [deleteBlockedReason, setDeleteBlockedReason] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [filter, setFilter] = React.useState("");
  const visibleDepartments = departments.filter((d) => matchesQuery(filter, d.name, d.code));

  const fail = (title: string, err: unknown) =>
    toast({ title, description: err instanceof Error ? err.message : "Something went wrong.", variant: "destructive" });

  const openForm = (row: DepartmentRow | "new") => {
    setName(row === "new" ? "" : row.name);
    setCode(row === "new" ? "" : row.code);
    setEditing(row);
  };

  const openDelete = (row: DepartmentRow) => {
    setDeleteBlockedReason(null);
    setDeleting(row);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!name.trim() || !code.trim()) {
      toast({ title: "Missing fields", description: "Name and code are required.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const isNew = editing === "new";
      await send(isNew ? "/api/departments" : `/api/departments/${editing.id}`, isNew ? "POST" : "PATCH", {
        name: name.trim(),
        code: code.trim(),
      });
      toast({ title: isNew ? "Department added" : "Department updated", description: `${name.trim()} (${code.trim().toUpperCase()})`, variant: "success" });
      setEditing(null);
      router.refresh();
    } catch (err) {
      fail("Save failed", err);
    } finally {
      setBusy(false);
    }
  };

  const setActive = async (row: DepartmentRow, isActive: boolean) => {
    setBusy(true);
    try {
      await send(`/api/departments/${row.id}`, "PATCH", { isActive });
      toast({ title: isActive ? "Department activated" : "Department deactivated", description: row.name, variant: "success" });
      setDeleting(null);
      router.refresh();
    } catch (err) {
      fail("Update failed", err);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await send(`/api/departments/${deleting.id}`, "DELETE");
      toast({ title: "Department deleted", description: deleting.name, variant: "success" });
      setDeleting(null);
      router.refresh();
    } catch (err) {
      if (err instanceof Error && (err as Error & { canDeactivate?: boolean }).canDeactivate) {
        setDeleteBlockedReason(err.message);
      } else {
        fail("Delete failed", err);
      }
    } finally {
      setBusy(false);
    }
  };

  const columns: DataTableColumn<DepartmentRow>[] = [
    { header: "Department", cell: (r) => <span className="font-medium text-foreground">{r.name}</span>, primary: true },
    { header: "Code", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { header: "Consultancies", cell: (r) => <span className="font-mono text-xs">{r.consultancyCount}</span> },
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
  ];

  if (canManage) {
    columns.push({
      header: "Actions",
      cell: (r) => (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => openForm(r)} className="gap-1" aria-label={`Edit ${r.name}`}>
            <Edit2 className="h-3.5 w-3.5" aria-hidden /> Edit
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setActive(r, !r.isActive)}>
            {r.isActive ? "Deactivate" : "Activate"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openDelete(r)} className="gap-1 text-status-danger-fg" aria-label={`Delete ${r.name}`}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
          </Button>
        </div>
      ),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-4">
          <CardTitle className="text-base font-semibold">All Departments ({departments.length})</CardTitle>
          {canManage && (
            <Button size="sm" onClick={() => openForm("new")} className="gap-1.5">
              <Plus className="h-4 w-4" aria-hidden /> Add
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {departments.length > 0 && (
            <FilterInput id="department-filter" label="Search departments" placeholder="Search name or code" value={filter} onChange={setFilter} />
          )}
          <DataTable
            columns={columns}
            data={visibleDepartments}
            keyFor={(r) => r.id}
            emptyState={
              filter.trim() ? (
                <EmptyState icon={Building2} title="No matches" description={`No department matches “${filter.trim()}”.`} />
              ) : (
                <EmptyState icon={Building2} title="No departments yet" />
              )
            }
          />
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Add department" : "Edit department"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitForm} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dept-name">Name</Label>
              <Input id="dept-name" placeholder="e.g. Computer Science & Engineering" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dept-code">Code</Label>
              <Input id="dept-code" placeholder="e.g. CSE" value={code} onChange={(e) => setCode(e.target.value)} className="font-mono uppercase" />
            </div>
            <DialogFooter className="mt-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-status-danger-fg" aria-hidden />
              Delete department
            </DialogTitle>
            <DialogDescription>
              Permanently delete <strong className="text-foreground">{deleting?.name} ({deleting?.code})</strong>? Only departments nothing refers to can be deleted.
            </DialogDescription>
          </DialogHeader>

          {deleteBlockedReason && (
            <p role="alert" className="rounded-md border border-status-warning-fg/30 bg-status-warning-bg p-3 text-sm text-status-warning-fg">
              {deleteBlockedReason}
            </p>
          )}

          <DialogFooter className="mt-2 gap-2">
            <Button type="button" variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            {deleteBlockedReason ? (
              deleting?.isActive && (
                <Button type="button" disabled={busy} onClick={() => deleting && setActive(deleting, false)}>
                  {busy ? "Deactivating…" : "Deactivate instead"}
                </Button>
              )
            ) : (
              <Button type="button" variant="destructive" disabled={busy} onClick={confirmDelete}>
                {busy ? "Deleting…" : "Delete"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
