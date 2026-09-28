"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FolderOpen } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { DocumentRepository } from "./document-repository";
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

  function selectConsultancy(id: string) {
    router.push(`/documents?consultancy=${id}`);
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
        <SearchableSelect
          aria-label="Consultancy"
          options={consultancies.map((c) => ({ code: c.id, label: `${c.consultancyCode ?? "Draft"} — ${c.title}` }))}
          value={selectedId ?? ""}
          onChange={selectConsultancy}
          placeholder="Choose a consultancy"
          searchPlaceholder="Search by Consultancy ID or title…"
        />
      </div>

      {selected && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-foreground">{selected.title}</h2>
            <StatusBadge status={selected.status} />
          </div>

          <DocumentRepository
            key={selected.id}
            consultancyId={selected.id}
            existingCategories={existingCategories}
            pinnedCategories={["Signed Agreement"]}
          />
        </div>
      )}
    </div>
  );
}
