export function supportsLinkedView({
  tmuxBackend,
  sessionName,
}: {
  tmuxBackend: boolean;
  sessionName?: string | null;
}): boolean {
  return Boolean(tmuxBackend && sessionName);
}
