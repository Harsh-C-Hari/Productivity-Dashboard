// Identity & Security types -- mirrors backend/app/schemas.py's
// "Identity & Security (Authentication / Authorization)" section and
// the ---------- Users ---------- / ---------- Sessions ---------- schemas.
// Kept in its own file (rather than folded into the large types/index.ts)
// since the Identity layer is its own module -- see ENGINEERING_GUIDELINES.md
// "Every feature should be modular."

export type UserStatus = "active" | "invited" | "suspended" | "deactivated";

export type AuthProviderType = "local" | "google" | "github" | "other";

export interface User {
  id: string;
  username: string;
  display_name: string;
  email: string;
  avatar_url: string;
  timezone: string;
  locale: string;
  theme: string;
  status: UserStatus;
  auth_provider: AuthProviderType;
  external_auth_id: string | null;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  display_name?: string;
}

export interface LoginRequest {
  username_or_email: string;
  password: string;
  device?: string;
  platform?: string;
  browser?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number; // access token lifetime, in seconds
  user: User;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface PasswordResetRequestOut {
  message: string;
  debug_reset_token?: string | null;
}

export interface EmailVerificationRequestOut {
  message: string;
  debug_verification_token?: string | null;
}

export interface AuthStatusOut {
  authenticated: boolean;
  user: User | null;
}

export interface ProfileUpdateRequest {
  display_name?: string;
  avatar_url?: string;
  timezone?: string;
  locale?: string;
  theme?: string;
}

export interface EmailUpdateRequest {
  email: string;
  current_password: string;
}

export interface DeactivateAccountRequest {
  current_password: string;
}

export interface Session {
  id: string;
  user_id: string;
  device: string;
  platform: string;
  browser: string;
  ip_address: string | null;
  expires_at: string;
  created_at: string;
  last_active_at: string | null;
  revoked: boolean;
  is_current: boolean;
}
