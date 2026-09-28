"use client";

import * as React from "react";
import { FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DOCUMENT_REPOSITORY_GROUPS, OTHER_DOCUMENT_GROUP, documentGroupFor } from "@/lib/documents/categories";
import { DocumentCategoryPanel } from "./document-category-panel";

const OTHER_OPTION = "__other__";

/**
 * A consultancy's central document folder (portal spec §24): the categories
 * that already hold documents, grouped Agreement / Execution / Financial /
 * Closure, plus a picker to start a new category. Each category keeps its
 * own version history (upload = new version, never an overwrite).
 */
export function DocumentRepository({
  consultancyId,
  existingCategories,
  pinnedCategories = [],
  canUpload = true,
}: {
  consultancyId: string;
  existingCategories: string[];
  /** Always shown even when empty (e.g. the mandatory Signed Agreement). */
  pinnedCategories?: string[];
  canUpload?: boolean;
}) {
  const [added, setAdded] = React.useState<string[]>([]);
  const [choice, setChoice] = React.useState("");
  const [otherName, setOtherName] = React.useState("");

  const categories = [...new Set([...pinnedCategories, ...existingCategories, ...added])];
  const groups = [...DOCUMENT_REPOSITORY_GROUPS.map((g) => g.group), OTHER_DOCUMENT_GROUP]
    .map((group) => ({ group, categories: categories.filter((c) => documentGroupFor(c) === group) }))
    .filter((g) => g.categories.length > 0);

  function addCategory() {
    const name = choice === OTHER_OPTION ? otherName.trim() : choice;
    if (!name) return;
    if (!categories.includes(name)) setAdded((prev) => [...prev, name]);
    setChoice("");
    setOtherName("");
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.length === 0 && (
        <EmptyState icon={FolderOpen} title="No documents yet" description="Choose a document category below to start uploading." />
      )}

      {groups.map((g) => (
        <div key={g.group} className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.group}</h3>
          {g.categories.map((category) => (
            <DocumentCategoryPanel key={category} consultancyId={consultancyId} category={category} label={category} />
          ))}
        </div>
      ))}

      {canUpload && (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-4 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor={`add-category-${consultancyId}`}>Add a document</Label>
            <Select value={choice || undefined} onValueChange={setChoice}>
              <SelectTrigger id={`add-category-${consultancyId}`}>
                <SelectValue placeholder="Choose a document category" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_REPOSITORY_GROUPS.map((g) => (
                  <SelectGroup key={g.group}>
                    <SelectLabel>{g.group}</SelectLabel>
                    {g.categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
                <SelectItem value={OTHER_OPTION}>Other…</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {choice === OTHER_OPTION && (
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor={`other-category-${consultancyId}`}>Category name</Label>
              <Input id={`other-category-${consultancyId}`} value={otherName} onChange={(e) => setOtherName(e.target.value)} maxLength={100} />
            </div>
          )}
          <Button type="button" variant="secondary" onClick={addCategory} disabled={!choice || (choice === OTHER_OPTION && !otherName.trim())}>
            <Plus className="h-4 w-4" aria-hidden />
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
