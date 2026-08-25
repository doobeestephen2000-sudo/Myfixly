import type { Session, User } from "@supabase/supabase-js";
import {
  AndroidBiometryStrength,
  BiometricAuth,
  BiometryError,
  BiometryErrorType,
} from "@aparajita/capacitor-biometric-auth";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { supabase } from "@/integrations/supabase/client";

const BIOMETRIC_VAULT_KEY = "myfixly.biometric.vault.v2";
const LEGACY_LOGIN_KEY = "biometric-login";
const LEGACY_SESSION_KEY = "biometric-session";

export type BiometricAvailability = { available: boolean; reason?: string };
export type BiometricAuthenticationResult = { success: boolean; cancelled?: boolean; reason?: string };

export type RememberedBiometricUser = { userId: string; enabled: boolean };
type RememberedBiometricSession = { userId: string; accessToken: string; refreshToken: string; expiresAt?: number };
type BiometricVault = RememberedBiometricUser & {
  version: 2;
  updatedAt: string;
  session?: RememberedBiometricSession;
};

let vaultWrite: Promise<void> = Promise.resolve();

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function log(_event: string, _details: Record<string, unknown> = {}): void {
  // Authentication state and secure-storage metadata must not be logged.
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Biometric authentication is unavailable.";
}

function isCancellation(error: unknown): boolean {
  return error instanceof BiometryError && [
    BiometryErrorType.userCancel,
    BiometryErrorType.systemCancel,
    BiometryErrorType.appCancel,
    BiometryErrorType.userFallback,
  ].includes(error.code);
}

function parseVault(value: string | null): BiometricVault | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<BiometricVault>;
    if (parsed.version !== 2 || !parsed.userId || typeof parsed.enabled !== "boolean") return null;
    if (parsed.session && (!parsed.session.accessToken || !parsed.session.refreshToken || parsed.session.userId !== parsed.userId)) return null;
    return parsed as BiometricVault;
  } catch {
    return null;
  }
}

async function readLegacyVault(): Promise<BiometricVault | null> {
  const [user, session] = await Promise.all([
    SecureStorage.get(LEGACY_LOGIN_KEY) as Promise<RememberedBiometricUser | null>,
    SecureStorage.get(LEGACY_SESSION_KEY) as Promise<RememberedBiometricSession | null>,
  ]);
  if (!user?.userId || !user.enabled) return null;

  const vault: BiometricVault = {
    version: 2,
    userId: user.userId,
    enabled: true,
    updatedAt: new Date().toISOString(),
    session: session?.userId === user.userId && session.accessToken && session.refreshToken ? session : undefined,
  };
  await SecureStorage.setItem(BIOMETRIC_VAULT_KEY, JSON.stringify(vault));
  log("legacy biometric record migrated", { userId: vault.userId, hasSession: Boolean(vault.session) });
  return vault;
}

async function readVault(): Promise<BiometricVault | null> {
  if (!canUseStorage()) return null;
  try {
    const vault = parseVault(await SecureStorage.getItem(BIOMETRIC_VAULT_KEY));
    if (vault) {
      log("secure vault loaded", { userId: vault.userId, enabled: vault.enabled, hasSession: Boolean(vault.session) });
      return vault;
    }
    return await readLegacyVault();
  } catch (error) {
    void error;
    return null;
  }
}

async function writeVault(vault: BiometricVault): Promise<void> {
  const write = async () => {
    const serialized = JSON.stringify(vault);
    await SecureStorage.setItem(BIOMETRIC_VAULT_KEY, serialized);
    const saved = parseVault(await SecureStorage.getItem(BIOMETRIC_VAULT_KEY));
    if (!saved || saved.updatedAt !== vault.updatedAt || saved.userId !== vault.userId || saved.session?.refreshToken !== vault.session?.refreshToken) {
      throw new Error("Secure storage verification failed.");
    }
    log("secure vault saved", { userId: vault.userId, enabled: vault.enabled, hasSession: Boolean(vault.session), expiresAt: vault.session?.expiresAt });
  };

  const next = vaultWrite.then(write, write);
  vaultWrite = next.catch(() => undefined);
  return next;
}

function sessionCredentials(session: Session): RememberedBiometricSession {
  return {
    userId: session.user.id,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at,
  };
}

async function clearStoredSession(): Promise<void> {
  const vault = await readVault();
  if (!vault) return;
  await writeVault({ ...vault, session: undefined, updatedAt: new Date().toISOString() });
  log("secure session removed while biometric preference was retained", { userId: vault.userId });
}

async function invalidateStoredCredential(userId: string): Promise<void> {
  const vault = await readVault();
  await writeVault({
    version: 2,
    userId,
    enabled: false,
    updatedAt: new Date().toISOString(),
  });
  log("fingerprint login disabled because its secure credential is no longer valid", { userId, hadVault: Boolean(vault) });
}

export const biometricAuth = {
  async checkAvailability(): Promise<BiometricAvailability> {
    try {
      const result = await BiometricAuth.checkBiometry();
      return { available: result.strongBiometryIsAvailable, reason: result.strongReason || result.reason };
    } catch (error) {
      return { available: false, reason: getErrorMessage(error) };
    }
  },

  async authenticate(): Promise<BiometricAuthenticationResult> {
    try {
      await BiometricAuth.authenticate({
        reason: "Verify your identity to sign in to Myfixly",
        cancelTitle: "Use password",
        allowDeviceCredential: false,
        iosFallbackTitle: "Use password",
        androidTitle: "Fingerprint login",
        androidSubtitle: "Verify your identity to continue",
        androidConfirmationRequired: false,
        androidBiometryStrength: AndroidBiometryStrength.strong,
      });
      return { success: true };
    } catch (error) {
      return { success: false, cancelled: isCancellation(error), reason: getErrorMessage(error) };
    }
  },

  async handleSuccess(): Promise<Session> {
    const vault = await readVault();
    const savedSession = vault?.session;
    if (!vault?.enabled || !savedSession) {
      log("biometric restore skipped because no complete secure vault exists", { hasVault: Boolean(vault), enabled: vault?.enabled ?? false, hasSession: Boolean(savedSession) });
      throw new Error("Fingerprint login needs one password sign-in to securely set up this device.");
    }

    log("restoring Supabase session from secure vault", { userId: savedSession.userId, expiresAt: savedSession.expiresAt });
    let result = await supabase.auth.setSession({ access_token: savedSession.accessToken, refresh_token: savedSession.refreshToken });

    if (result.error || !result.data.session) {
      log("setSession failed; attempting refresh-token recovery", { userId: savedSession.userId, message: result.error?.message });
      result = await supabase.auth.refreshSession({ refresh_token: savedSession.refreshToken });
    }

    if (result.error || !result.data.session) {
      log("secure refresh token was rejected", { userId: savedSession.userId, message: result.error?.message });
      await invalidateStoredCredential(savedSession.userId);
      throw new Error("Your fingerprint sign-in credential has expired. Please sign in with your password and enable fingerprint login again.");
    }

    const session = result.data.session;
    if (session.user.id !== savedSession.userId) {
      log("secure session user mismatch", { expectedUserId: savedSession.userId, actualUserId: session.user.id });
      await supabase.auth.signOut({ scope: "local" });
      await invalidateStoredCredential(savedSession.userId);
      throw new Error("This fingerprint is not linked to the saved account. Please sign in with your password.");
    }

    // setSession accepts locally stored credentials; verify them with Supabase
    // before letting the app enter an authenticated route.
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user || userData.user.id !== savedSession.userId) {
      log("restored session could not be confirmed", { userId: savedSession.userId, message: userError?.message });
      await supabase.auth.signOut({ scope: "local" });
      await invalidateStoredCredential(savedSession.userId);
      throw new Error("Your fingerprint sign-in credential could not be verified. Please sign in with your password and enable fingerprint login again.");
    }

    await rememberBiometricSession(session);
    log("Supabase session restored", { userId: session.user.id, expiresAt: session.expires_at });
    return session;
  },

  async handleFailure(_result: BiometricAuthenticationResult): Promise<void> {},
};

export function isBiometricLoginEnabled(user: User): boolean {
  return user.user_metadata?.biometric_login_enabled === true;
}

export async function rememberBiometricLoginPreference(user: User): Promise<void> {
  if (!canUseStorage()) return;
  const existing = await readVault();
  await writeVault({
    version: 2,
    userId: user.id,
    enabled: isBiometricLoginEnabled(user),
    updatedAt: new Date().toISOString(),
    session: existing?.userId === user.id ? existing.session : undefined,
  });
}

export async function rememberBiometricSession(session: Session): Promise<void> {
  if (!canUseStorage()) return;
  const existing = await readVault();
  // Only refresh an already verified device credential. Creating a vault from
  // a generic SIGNED_IN event would silently re-enable a credential that was
  // deleted or marked invalid on this device.
  if (!existing?.enabled || existing.userId !== session.user.id) return;
  await writeVault({
    version: 2,
    userId: session.user.id,
    enabled: true,
    updatedAt: new Date().toISOString(),
    session: sessionCredentials(session),
  });
}

/**
 * Enables biometric login on this device and stores the current Supabase
 * session in one verified secure-storage write. Keeping these values together
 * prevents a fingerprint preference from being saved without credentials to
 * restore after a restart.
 */
export async function enableBiometricLogin(user: User, session: Session): Promise<void> {
  if (!canUseStorage()) return;
  if (user.id !== session.user.id) throw new Error("The current sign-in session belongs to a different account.");

  await writeVault({
    version: 2,
    userId: user.id,
    enabled: true,
    updatedAt: new Date().toISOString(),
    session: sessionCredentials(session),
  });
  log("fingerprint login enabled with a secure session", { userId: user.id, expiresAt: session.expires_at });
}

export async function getRememberedBiometricUser(): Promise<RememberedBiometricUser | null> {
  const vault = await readVault();
  return vault?.enabled ? { userId: vault.userId, enabled: true } : null;
}

/**
 * Reads the biometric preference and its credentials from one vault snapshot.
 * Keeping this operation together prevents startup from observing a preference
 * without the session that was written alongside it.
 */
export async function getRememberedBiometricLogin(): Promise<RememberedBiometricUser | null> {
  const vault = await readVault();
  if (!vault?.enabled || !vault.session) return null;
  return { userId: vault.userId, enabled: true };
}

/** True after a known credential failure, so password sign-in does not silently re-enable it. */
export async function isBiometricCredentialInvalidated(userId: string): Promise<boolean> {
  const vault = await readVault();
  return vault?.userId === userId && vault.enabled === false;
}

export async function hasRememberedBiometricSession(): Promise<boolean> {
  const vault = await readVault();
  return Boolean(vault?.enabled && vault.session);
}

export async function clearRememberedBiometricUser(): Promise<void> {
  if (!canUseStorage()) return;
  await SecureStorage.remove(BIOMETRIC_VAULT_KEY);
  await Promise.all([SecureStorage.remove(LEGACY_LOGIN_KEY), SecureStorage.remove(LEGACY_SESSION_KEY)]);
  log("all biometric credentials removed by user action");
}

export async function clearRememberedBiometricSession(): Promise<void> {
  if (!canUseStorage()) return;
  await clearStoredSession();
}
