import { useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format, isPast } from "date-fns";
import { Mail, CheckCircle2, XCircle, Clock, Ban, AlertTriangle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { NOTIFICATIONS_KEY } from "@/hooks/useNotificationCenter";
import { PROJECT_MEMBERS_KEY } from "@/hooks/useProjectMembers";
import { PROJECT_INVITATIONS_KEY } from "@/hooks/useProjectInvitations";

/**
 * Public "join a project" page for an invitee following an /invite/{token}
 * link -- see AI_HANDOFF.md "Invitation Page". Validates the token, shows
 * Project/Owner/Role/Status/Expiry, and offers Accept/Reject. No email is
 * ever sent to reach this page (see routers/project_invitations.py); it's
 * reached either from a copied invite link (owner-shared) or from a
 * Notification's "View invitation" action for an existing account.
 */
export default function InvitationLanding() {
  const { token = "" } = useParams<{ token: string }>();
  const location = useLocation();
  const { user, status: authStatus } = useAuth();
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [actionTaken, setActionTaken] = useState<"accepted" | "rejected" | null>(null);

  const { data: invitation, isLoading, error } = useQuery({
    queryKey: ["invitation-preview", token],
    queryFn: () => api.getInvitationByToken(token),
    enabled: !!token,
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => api.acceptInvitation(token, user ? undefined : displayName || undefined),
    onSuccess: () => {
      setActionTaken("accepted");
      qc.invalidateQueries({ queryKey: ["invitation-preview", token] });
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      if (invitation?.project_id) {
        qc.invalidateQueries({ queryKey: [...PROJECT_MEMBERS_KEY, invitation.project_id] });
        qc.invalidateQueries({ queryKey: [...PROJECT_INVITATIONS_KEY, invitation.project_id] });
      }
    },
  });

  const reject = useMutation({
    mutationFn: () => api.rejectInvitation(token),
    onSuccess: () => {
      setActionTaken("rejected");
      qc.invalidateQueries({ queryKey: ["invitation-preview", token] });
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      if (invitation?.project_id) {
        qc.invalidateQueries({ queryKey: [...PROJECT_INVITATIONS_KEY, invitation.project_id] });
      }
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-950 px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-md glass-card p-6 sm:p-8"
      >
        <div className="flex items-center gap-2.5 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Zap className="h-4.5 w-4.5 text-primary-foreground" fill="currentColor" />
          </div>
          <p className="font-display font-semibold text-sm">Prod Dashboard</p>
        </div>

        {isLoading && (
          <div className="flex flex-col gap-3">
            <div className="h-5 w-2/3 rounded bg-white/[0.04] animate-pulse" />
            <div className="h-4 w-full rounded bg-white/[0.04] animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-white/[0.04] animate-pulse" />
          </div>
        )}

        {!isLoading && (error || !invitation) && (
          <InvalidState message={(error as Error)?.message} />
        )}

        {!isLoading && invitation && !actionTaken && (
          <>
            {invitation.status === "pending" ? (
              <PendingInvitation
                invitation={invitation}
                canAct={!isPast(new Date(invitation.expires_at))}
                loggedInEmail={user?.email}
                authLoading={authStatus === "loading"}
                displayName={displayName}
                onDisplayNameChange={setDisplayName}
                onAccept={() => accept.mutate()}
                onReject={() => reject.mutate()}
                accepting={accept.isPending}
                rejecting={reject.isPending}
                error={(accept.error as Error)?.message || (reject.error as Error)?.message}
                returnTo={location}
              />
            ) : (
              <ResolvedState status={invitation.status} projectName={invitation.project_name} />
            )}
          </>
        )}

        {actionTaken === "accepted" && (
          <SuccessState
            projectName={invitation?.project_name ?? "the project"}
            isAuthenticated={!!user}
            projectId={invitation?.project_id}
          />
        )}
        {actionTaken === "rejected" && <DeclinedState projectName={invitation?.project_name ?? "the project"} />}
      </motion.div>
    </div>
  );
}

function PendingInvitation({
  invitation,
  canAct,
  loggedInEmail,
  authLoading,
  displayName,
  onDisplayNameChange,
  onAccept,
  onReject,
  accepting,
  rejecting,
  error,
  returnTo,
}: {
  invitation: NonNullable<Awaited<ReturnType<typeof api.getInvitationByToken>>>;
  canAct: boolean;
  loggedInEmail: string | undefined;
  authLoading: boolean;
  displayName: string;
  onDisplayNameChange: (v: string) => void;
  onAccept: () => void;
  onReject: () => void;
  accepting: boolean;
  rejecting: boolean;
  error?: string;
  returnTo: ReturnType<typeof useLocation>;
}) {
  if (!canAct) {
    return <ResolvedState status="expired" projectName={invitation.project_name} />;
  }

  const emailMismatch = !!loggedInEmail && loggedInEmail.toLowerCase() !== invitation.email.toLowerCase();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-lg font-semibold leading-tight">
            {invitation.invited_by_name ?? "Someone"} invited you to
          </h1>
          <p className="text-primary font-medium">{invitation.project_name || "a project"}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 text-sm rounded-xl border border-white/10 bg-base-900/40 p-3.5">
        <Row label="Invited email" value={invitation.email} />
        <Row label="Role" value={invitation.role_name ?? "Member"} />
        <Row label="Expires" value={format(new Date(invitation.expires_at), "MMM d, yyyy 'at' h:mm a")} />
      </div>

      {authLoading ? (
        <div className="h-10 rounded-xl bg-white/[0.04] animate-pulse" />
      ) : loggedInEmail ? (
        <>
          {emailMismatch && (
            <p className="flex items-start gap-2 text-xs text-urgency-medium">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              You're signed in as {loggedInEmail}, but this invitation was sent to {invitation.email}. You can still
              accept it with your current account if that's intended.
            </p>
          )}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={onAccept} disabled={accepting || rejecting}>
              {accepting ? "Accepting…" : "Accept"}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={onReject} disabled={accepting || rejecting}>
              {rejecting ? "Rejecting…" : "Reject"}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Your name (for the new account)</label>
            <input
              value={displayName}
              onChange={(e) => onDisplayNameChange(e.target.value)}
              placeholder="Jordan Lee"
              className="rounded-xl border border-white/10 bg-base-900/60 px-3 py-2 text-sm outline-none focus:border-primary/50"
            />
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={onAccept} disabled={accepting || rejecting}>
              {accepting ? "Accepting…" : "Accept"}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={onReject} disabled={accepting || rejecting}>
              {rejecting ? "Rejecting…" : "Reject"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Already have an account?{" "}
            <Link to="/login" state={{ from: returnTo }} className="text-primary hover:underline">
              Sign in
            </Link>{" "}
            first to accept as {invitation.email}.
          </p>
        </>
      )}

      {error && <p className="text-xs text-urgency-critical">{error}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function InvalidState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-urgency-critical/15 text-urgency-critical">
        <XCircle className="h-6 w-6" />
      </div>
      <h1 className="font-display text-lg font-semibold">Invalid invitation link</h1>
      <p className="text-sm text-muted-foreground">
        {message?.toLowerCase().includes("not found")
          ? "This invitation link doesn't exist. It may have been mistyped, or the invitation was deleted."
          : message || "This invitation link couldn't be loaded."}
      </p>
      <Link to="/login" className="text-sm text-primary hover:underline">
        Go to sign in
      </Link>
    </div>
  );
}

function ResolvedState({ status, projectName }: { status: string; projectName: string }) {
  const meta: Record<string, { icon: typeof CheckCircle2; color: string; title: string; body: string }> = {
    accepted: {
      icon: CheckCircle2,
      color: "bg-urgency-low/15 text-urgency-low",
      title: "Already accepted",
      body: `You're already a member of "${projectName}".`,
    },
    rejected: {
      icon: XCircle,
      color: "bg-urgency-critical/15 text-urgency-critical",
      title: "Invitation declined",
      body: `You previously declined this invitation to "${projectName}".`,
    },
    expired: {
      icon: Clock,
      color: "bg-white/10 text-muted-foreground",
      title: "Invitation expired",
      body: "This invitation link is no longer valid. Ask the project owner to resend it.",
    },
    revoked: {
      icon: Ban,
      color: "bg-white/10 text-muted-foreground",
      title: "Invitation cancelled",
      body: "This invitation was cancelled by the project owner.",
    },
  };
  const m = meta[status] ?? meta.revoked;
  const Icon = m.icon;
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${m.color}`}>
        <Icon className="h-6 w-6" />
      </div>
      <h1 className="font-display text-lg font-semibold">{m.title}</h1>
      <p className="text-sm text-muted-foreground">{m.body}</p>
      <Link to="/" className="text-sm text-primary hover:underline">
        Go to dashboard
      </Link>
    </div>
  );
}

function SuccessState({
  projectName,
  isAuthenticated,
  projectId,
}: {
  projectName: string;
  isAuthenticated: boolean;
  projectId?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-urgency-low/15 text-urgency-low">
        <CheckCircle2 className="h-6 w-6" />
      </div>
      <h1 className="font-display text-lg font-semibold">You're in!</h1>
      <p className="text-sm text-muted-foreground">
        You've joined <span className="text-foreground font-medium">{projectName}</span>.
      </p>
      {isAuthenticated ? (
        <Link to={projectId ? `/projects/${projectId}` : "/"} className="text-sm text-primary hover:underline">
          Open project
        </Link>
      ) : (
        <p className="text-xs text-muted-foreground">
          An account was created for you. <Link to="/login" className="text-primary hover:underline">Sign in</Link> or{" "}
          <Link to="/forgot-password" className="text-primary hover:underline">set a password</Link> to access it.
        </p>
      )}
    </div>
  );
}

function DeclinedState({ projectName }: { projectName: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-muted-foreground">
        <XCircle className="h-6 w-6" />
      </div>
      <h1 className="font-display text-lg font-semibold">Invitation declined</h1>
      <p className="text-sm text-muted-foreground">
        You've declined the invitation to <span className="text-foreground font-medium">{projectName}</span>.
      </p>
      <Link to="/login" className="text-sm text-primary hover:underline">
        Go to sign in
      </Link>
    </div>
  );
}
