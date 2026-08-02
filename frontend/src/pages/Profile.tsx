import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { motion } from "framer-motion";
import {
  User as UserIcon,
  Mail,
  KeyRound,
  Monitor,
  ShieldAlert,
  Loader2,
  Save,
  MailCheck,
  Camera,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrengthMeter, passwordMeetsRequirements } from "@/components/auth/PasswordStrengthMeter";
import { FormAlert } from "@/components/auth/FormAlert";
import { SessionRow } from "@/components/auth/SessionRow";
import { AvatarCropperDialog } from "@/components/profile/AvatarCropperDialog";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { useSessions, useRevokeSession, useRevokeOtherSessions, useLogoutAllDevices } from "@/hooks/useSessions";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";

const TIMEZONES =
  typeof Intl !== "undefined" && "supportedValuesOf" in Intl
    ? (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone")
    : ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Kolkata", "Asia/Tokyo"];

const LOCALES = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "hi", label: "हिन्दी" },
  { value: "ml", label: "മലയാളം" },
];

export default function Profile() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-4 max-w-2xl"
    >
      <ProfileInfoCard />
      <EmailCard />
      <PasswordCard />
      <SessionsCard />
      <DangerZoneCard />
    </motion.div>
  );
}

function ProfileInfoCard() {
  const { user, updateUser } = useAuth();
  const { toast } = useNotifications();
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? "");
  const [timezone, setTimezone] = useState(user?.timezone ?? "UTC");
  const [locale, setLocale] = useState(user?.locale ?? "en");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pickerFile, setPickerFile] = useState<File | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);

  const dirty =
    displayName !== (user?.display_name ?? "") ||
    avatarUrl !== (user?.avatar_url ?? "") ||
    timezone !== (user?.timezone ?? "UTC") ||
    locale !== (user?.locale ?? "en");

  function handlePickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!picked || !picked.type.startsWith("image/")) return;
    setPickerFile(picked);
    setCropperOpen(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateProfile({
        display_name: displayName,
        avatar_url: avatarUrl,
        timezone,
        locale,
      });
      updateUser(updated);
      toast("Profile updated", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update your profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <UserIcon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <CardTitle>Profile</CardTitle>
          <CardDescription>@{user?.username}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {error && <FormAlert variant="error">{error}</FormAlert>}

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Change photo"
              className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-base-800"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-display text-xl font-semibold text-muted-foreground">
                  {(displayName || user?.username || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="h-5 w-5 text-white" />
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePickPhoto}
            />
            <div className="flex-1 flex flex-col gap-1.5">
              <Label htmlFor="avatar_url">Avatar URL</Label>
              {avatarUrl.startsWith("data:") ? (
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-base-900/40 px-3 py-2 text-sm text-muted-foreground">
                  <span className="flex-1 truncate">Photo selected from your device</span>
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(user?.avatar_url ?? "")}
                    className="shrink-0 text-xs font-medium text-primary hover:underline"
                  >
                    Undo
                  </button>
                </div>
              ) : (
                <Input
                  id="avatar_url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://… or tap your photo to upload"
                />
              )}
            </div>
          </div>

          <AvatarCropperDialog
            file={pickerFile}
            open={cropperOpen}
            onOpenChange={setCropperOpen}
            onCropped={(dataUrl) => setAvatarUrl(dataUrl)}
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="display_name">Display name</Label>
            <Input
              id="display_name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={150}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {TIMEZONES.map((tz: string) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Language</Label>
              <Select value={locale} onValueChange={setLocale}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCALES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Theme</Label>
            <p className="text-sm text-muted-foreground">
              This app ships with a single gaming-inspired dark theme -- light mode isn't implemented
              yet (see Settings).
            </p>
          </div>

          <Button type="submit" disabled={!dirty || saving} className="self-start gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function EmailCard() {
  const { user, updateUser } = useAuth();
  const { toast } = useNotifications();
  const [email, setEmail] = useState(user?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = email.trim() !== (user?.email ?? "") && email.trim().length > 2 && currentPassword.length > 0;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateEmail({ email: email.trim(), current_password: currentPassword });
      updateUser(updated);
      setCurrentPassword("");
      toast("Email updated -- verify your new address when you get a chance", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update your email");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/10">
          <Mail className="h-4 w-4 text-secondary" />
        </div>
        <CardTitle>Email address</CardTitle>
        <Badge variant={user?.email_verified ? "default" : "secondary"} className="ml-auto">
          {user?.email_verified ? "Verified" : "Unverified"}
        </Badge>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {error && <FormAlert variant="error">{error}</FormAlert>}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {email.trim() !== (user?.email ?? "") && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email_current_password">Current password (to confirm this change)</Label>
              <PasswordInput
                id="email_current_password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
          )}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={!dirty || saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : "Update email"}
            </Button>
            {!user?.email_verified && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/verify-email" className="gap-1.5 inline-flex items-center">
                  <MailCheck className="h-3.5 w-3.5" /> Verify email
                </Link>
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordCard() {
  const { toast } = useNotifications();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    currentPassword.length > 0 && passwordMeetsRequirements(newPassword) && newPassword === confirmPassword;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await api.changePassword({ current_password: currentPassword, new_password: newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast("Password changed -- every other device has been signed out", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change your password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
          <KeyRound className="h-4 w-4 text-accent" />
        </div>
        <CardTitle>Password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {error && <FormAlert variant="error">{error}</FormAlert>}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="current_password">Current password</Label>
            <PasswordInput
              id="current_password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new_password">New password</Label>
            <PasswordInput
              id="new_password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <PasswordStrengthMeter password={newPassword} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm_new_password">Confirm new password</Label>
            <PasswordInput
              id="confirm_new_password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {confirmPassword.length > 0 && confirmPassword !== newPassword && (
              <p className="text-xs text-urgency-critical">Passwords don't match</p>
            )}
          </div>
          <Button type="submit" disabled={!canSubmit || saving} className="self-start gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {saving ? "Changing…" : "Change password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SessionsCard() {
  const { data: sessions, isLoading } = useSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const logoutAll = useLogoutAllDevices();

  const sorted = useMemo(
    () => (sessions ?? []).slice().sort((a, b) => (a.is_current ? -1 : b.is_current ? 1 : 0)),
    [sessions]
  );
  const otherCount = sorted.filter((s) => !s.is_current).length;

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Monitor className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <CardTitle>Active sessions</CardTitle>
          <CardDescription>Devices currently signed in to your account</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions.</p>
        ) : (
          sorted.map((s) => (
            <SessionRow key={s.id} session={s} onRevoke={(id) => revoke.mutate(id)} revoking={revoke.isPending} />
          ))
        )}

        {otherCount > 0 && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => revokeOthers.mutate()}
                disabled={revokeOthers.isPending}
              >
                Sign out other devices ({otherCount})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-urgency-critical border-urgency-critical/30 hover:bg-urgency-critical/10"
                onClick={() => logoutAll.mutate()}
                disabled={logoutAll.isPending}
              >
                Sign out everywhere
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DangerZoneCard() {
  const { logout } = useAuth();
  const { toast } = useNotifications();
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDeactivate() {
    if (!currentPassword) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.deactivateAccount({ current_password: currentPassword });
      toast("Account deactivated", "info");
      await logout();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't deactivate your account");
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-urgency-critical/20">
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-urgency-critical/10">
          <ShieldAlert className="h-4 w-4 text-urgency-critical" />
        </div>
        <CardTitle>Danger zone</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && <FormAlert variant="error">{error}</FormAlert>}
        <CardDescription>
          Deactivating your account signs you out of every device immediately. It's a soft delete --
          your data stays intact and this can be reversed by support later, but you won't be able to
          sign back in yourself.
        </CardDescription>

        {!confirming ? (
          <Button
            variant="outline"
            className="self-start text-urgency-critical border-urgency-critical/30 hover:bg-urgency-critical/10"
            onClick={() => setConfirming(true)}
          >
            Deactivate account
          </Button>
        ) : (
          <div className="flex flex-col gap-3 rounded-xl border border-urgency-critical/20 bg-urgency-critical/5 p-3.5">
            <Label htmlFor="deactivate_password">Enter your password to confirm</Label>
            <PasswordInput
              id="deactivate_password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                disabled={!currentPassword || submitting}
                onClick={handleDeactivate}
                className="gap-2"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm deactivation
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={submitting}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
