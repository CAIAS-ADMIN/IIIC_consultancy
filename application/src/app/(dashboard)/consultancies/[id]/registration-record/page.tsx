import { RecordPage } from "@/components/records/record-page";

/** The consultancy's Registration Record — printable page; "Download PDF" gives the same content on the CAIAS / IIIC letterhead. */
export default async function RegistrationRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecordPage kind="registration" consultancyId={id} />;
}
