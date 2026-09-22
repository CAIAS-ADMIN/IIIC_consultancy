/**
 * Stub malware-scan hook (Phase 5 task 6). Called after upload, before a
 * document's status flips to `available`. Real integration (ClamAV, a cloud
 * AV API, etc.) is a follow-up — flagged in the build plan as acceptable to
 * stub for now.
 */
export async function scanDocument(objectKey: string): Promise<{ clean: boolean }> {
  void objectKey;
  return { clean: true };
}
