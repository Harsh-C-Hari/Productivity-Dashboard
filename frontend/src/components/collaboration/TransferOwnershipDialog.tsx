import { ConfirmDialog } from "./ConfirmDialog";
import { useTransferProjectOwnership } from "@/hooks/useProjectMembers";
import type { ProjectMemberWithUser } from "@/types/collaboration";

interface TransferOwnershipDialogProps {
  projectId: string;
  target: ProjectMemberWithUser | null;
  onOpenChange: (open: boolean) => void;
}

export function TransferOwnershipDialog({ projectId, target, onOpenChange }: TransferOwnershipDialogProps) {
  const transferOwnership = useTransferProjectOwnership(projectId);
  const name = target?.user?.display_name || target?.user?.username || "this member";

  return (
    <ConfirmDialog
      open={!!target}
      onOpenChange={onOpenChange}
      title="Transfer ownership?"
      description={`${name} will become the project's Owner. You'll be moved to the Admin role and keep full access, but ownership itself (billing, danger zone actions) transfers immediately and can't be undone from here.`}
      confirmLabel="Transfer ownership"
      variant="destructive"
      loading={transferOwnership.isPending}
      onConfirm={() => {
        if (!target) return;
        transferOwnership.mutate(target.user_id, { onSuccess: () => onOpenChange(false) });
      }}
    />
  );
}
