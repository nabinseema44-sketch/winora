import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  onAuthStateChanged,
  updateProfile,
  type User,
  type Unsubscribe,
  type ConfirmationResult,
  type ApplicationVerifier,
} from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from './config';
import { handleFirebaseError, getAuthErrorMessage } from './errorHandling';

export interface AuthResult<T = User> {
  success: boolean;
  data?: T;
  error?: string;
}

// Keep exactly one verifier for the dedicated login container.
let activeVerifier: RecaptchaVerifier | null = null;
let activeContainerId: string | null = null;

/**
 * Resets and cleans up any currently active reCAPTCHA verifier widget.
 * The container is also emptied because Firebase may leave the rendered iframe
 * in the DOM after verifier.clear(). This prevents the next verifier from
 * trying to render into an already-used element.
 */
export function clearRecaptchaVerifier(): void {
  const containerId = activeContainerId;

  if (activeVerifier) {
    try {
      activeVerifier.clear();
    } catch {
      // Ignore cleanup errors; DOM cleanup is still attempted.
    }
  }

  activeVerifier = null;
  activeContainerId = null;

  if (containerId) {
    const containerElement = document.getElementById(containerId);
    if (containerElement) {
      containerElement.innerHTML = '';
    }
  }
}

/**
 * Initializes or returns the existing RecaptchaVerifier for the specified
 * dedicated container. Stale verifier/container state is fully cleaned before
 * a new verifier is constructed.
 */
export function getOrCreateRecaptchaVerifier(
  containerId: string = 'recaptcha-container',
  size: 'invisible' | 'normal' = 'invisible'
): RecaptchaVerifier | null {
  const auth = getFirebaseAuth();
  if (!auth) return null;

  const containerElement = document.getElementById(containerId);
  if (!containerElement) {
    return null;
  }

  // Reuse only when the active verifier belongs to this exact container.
  if (activeVerifier && activeContainerId === containerId) {
    return activeVerifier;
  }

  // A verifier for another container is stale for this login flow.
  if (activeVerifier || activeContainerId) {
    clearRecaptchaVerifier();
  }

  // This element is dedicated to reCAPTCHA. Remove any stale widget/iframe
  // left behind by a previous verifier before constructing a new one.
  if (containerElement.childNodes.length > 0) {
    containerElement.innerHTML = '';
  }

  try {
    activeVerifier = new RecaptchaVerifier(auth, containerId, {
      size,
      callback: () => {
        // reCAPTCHA solved
      },
      'expired-callback': () => {
        console.warn('[WINORA] reCAPTCHA session expired.');
      },
    });
    activeContainerId = containerId;
    return activeVerifier;
  } catch (err) {
    activeVerifier = null;
    activeContainerId = null;
    console.error('[WINORA] Failed to initialize RecaptchaVerifier:', err);
    return null;
  }
}

/**
 * Send an SMS OTP to the provided phone number using Firebase Phone Authentication.
 * Mobile number must include the country code in E.164 format (e.g., +919876543210).
 */
export async function sendPhoneOtp(
  phoneNumber: string,
  verifier: ApplicationVerifier
): Promise<AuthResult<ConfirmationResult>> {
  if (!isFirebaseConfigured()) {
    return {
      success: false,
      error: 'Firebase is not configured. Please set your Firebase environment variables in .env.',
    };
  }

  const auth = getFirebaseAuth();
  if (!auth) {
    return { success: false, error: 'Firebase Authentication is unavailable.' };
  }

  try {
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber.trim(), verifier);
    return {
      success: true,
      data: confirmationResult,
    };
  } catch (error) {
    handleFirebaseError(error, 'auth', 'auth/sendPhoneOtp');
    return {
      success: false,
      error: getAuthErrorMessage(error),
    };
  }
}

/**
 * Verify the SMS OTP code provided by the player.
 * Completes sign-in / registration in Firebase Authentication.
 */
export async function verifyPhoneOtp(
  confirmationResult: ConfirmationResult,
  otpCode: string,
  displayName?: string
): Promise<AuthResult<User>> {
  try {
    const credential = await confirmationResult.confirm(otpCode.trim());
    const user = credential.user;

    if (displayName && displayName.trim().length > 0) {
      try {
        await updateProfile(user, { displayName: displayName.trim() });
      } catch (profileErr) {
        console.warn('[WINORA] Profile displayName sync notice:', profileErr);
      }
    }

    return {
      success: true,
      data: user,
    };
  } catch (error) {
    handleFirebaseError(error, 'auth', 'auth/verifyPhoneOtp');
    return {
      success: false,
      error: getAuthErrorMessage(error),
    };
  }
}

/**
 * Sign out the currently authenticated user.
 */
export async function logoutUser(): Promise<AuthResult<void>> {
  const auth = getFirebaseAuth();
  if (!auth) {
    return { success: true };
  }

  try {
    clearRecaptchaVerifier();
    await signOut(auth);
    return { success: true };
  } catch (error) {
    const errInfo = handleFirebaseError(error, 'auth', 'auth/logout');
    return { success: false, error: errInfo.error };
  }
}

/**
 * Get the currently authenticated Firebase user snapshot.
 */
export function getCurrentAuthUser(): User | null {
  const auth = getFirebaseAuth();
  return auth ? auth.currentUser : null;
}

/**
 * Listen for Firebase Authentication state transitions.
 * Returns an unsubscribe callback.
 */
export function onAuthChange(callback: (user: User | null) => void): Unsubscribe {
  const auth = getFirebaseAuth();
  if (!auth) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, callback, (error) => {
    handleFirebaseError(error, 'auth', 'auth/stateListener');
    callback(null);
  });
}

/**
 * Diagnostic check to verify Firebase Auth service availability.
 */
export async function testAuthConnection(): Promise<{ connected: boolean; message: string }> {
  if (!isFirebaseConfigured()) {
    return {
      connected: false,
      message: 'Firebase configuration credentials are missing or set to placeholder values in .env.',
    };
  }

  const auth = getFirebaseAuth();
  if (!auth) {
    return {
      connected: false,
      message: 'Failed to initialize FirebaseAuth instance.',
    };
  }

  return {
    connected: true,
    message: `Firebase Auth is active for project: ${auth.app.options.projectId}`,
  };
}
