"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { DocumentCategoryPanel } from "./document-category-panel";
import type { ConsultancyStatus } from "@/db/schema/enums";

type ConsultancyOption = {
  id: string;
  title: string;
  consultancyCode: string | null;
  status: ConsultancyStatus;
};

export function DocumentsHub({
  consultancies,
  selectedId,
  existingCategories,
}: {
  consultancies: ConsultancyOption[];
  selectedId: string | null;
  existingCategories: string[];
}) {
  const router = useRouter();
  const [addedCategories, setAddedCategories] = React.useState<string[]>([]);
  const [newCategory, setNewCategory] = React.useState("");

  const categories = [...new Set([...existingCategories, ...addedCategories])];

  function selectConsultancy(id: string) {
    setAddedCategories([]);
    router.push(`/documents?consultancy=${id}`);
  }

  function addCategory() {
    const trimmed = newCategory.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    setAddedCategories((prev) => [...prev, trimmed]);
    setNewCategory("");
  }

  if (consultancies.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="No consultancies yet"
        description="Once a consultancy exists, its documents will be manageable here."
      />
    );
  }

  const selected = consultancies.find((c) => c.id === selectedId);

  return (
    <div className="flex flex-col gap-6">
      <div className="max-w-md">
        <Select value={selectedId ?? undefined} onValueChange={selectConsultancy}>
          <SelectTrigger aria-label="Consultancy">
            <SelectValue placeholder="Choose a consultancy" />
          </SelectTrigger>
          <SelectContent>
            {consultancies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.consultancyCode ?? "Draft"} — {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-foreground">{selected.title}</h2>
            <StatusBadge status={selected.status} />
          </div>

          {categories.length === 0 && (
            <EmptyState
              icon={FolderOpen}
              title="No documents yet"
              description="Add a document category below to start uploading."
            />
          )}

          {categories.map((category) => (
            <DocumentCategoryPanel key={category} consultancyId={selected.id} category={category} label={category} />
          ))}

          <div className="flex items-end gap-2 rounded-lg border border-dashed border-border p-4">
            <div className="flex-1">
              <label htmlFor="new-category" className="text-sm font-medium text-foreground">
                Add a document category
              </label>
              <Input
                id="new-category"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCategory();
                  }
                }}
                placeholder="e.g. Progress Report"
                className="mt-1.5"
              />
            </div>
            <Button type="button" variant="secondary" onClick={addCategory} disabled={!newCategory.trim()}>
              <Plus className="h-4 w-4" aria-hidden />
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
