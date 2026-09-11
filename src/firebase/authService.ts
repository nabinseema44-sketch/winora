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

// Keep exactly one verifier for the login flow.
let activeVerifier: RecaptchaVerifier | null = null;
let activeContainerId: string | null = null;
let activeContainerIsDedicatedElement = false;

/**
 * Resets and cleans up the currently active reCAPTCHA verifier.
 *
 * For invisible reCAPTCHA Firebase recommends using the submit button itself
 * as the verifier container. That button must NOT be emptied because React
 * owns its children. Dedicated reCAPTCHA containers can safely be emptied.
 */
export function clearRecaptchaVerifier(): void {
  const containerId = activeContainerId;
  const shouldClearDom = activeContainerIsDedicatedElement;

  if (activeVerifier) {
    try {
      activeVerifier.clear();
    } catch {
      // Ignore cleanup errors; the verifier reference is still discarded.
    }
  }

  activeVerifier = null;
  activeContainerId = null;
  activeContainerIsDedicatedElement = false;

  if (shouldClearDom && containerId) {
    const containerElement = document.getElementById(containerId);
    if (containerElement) {
      containerElement.innerHTML = '';
    }
  }
}

/**
 * Initializes or returns the existing RecaptchaVerifier for the specified
 * login flow. Invisible Firebase reCAPTCHA is attached to the submit button,
 * which avoids rendering into a separate React-managed div that can become
 * stale across SPA remounts.
 */
export function getOrCreateRecaptchaVerifier(
  containerId: string = 'recaptcha-container',
  size: 'invisible' | 'normal' = 'invisible'
): RecaptchaVerifier | null {
  const auth = getFirebaseAuth();
  if (!auth) return null;

  // Firebase's documented invisible-reCAPTCHA pattern uses the submit button
  // as the container. Keep the existing caller API unchanged.
  const isLoginFlow = containerId === 'login-recaptcha-container' && size === 'invisible';
  const effectiveContainerId = isLoginFlow ? 'login-send-otp-btn' : containerId;
  const dedicatedElement = !isLoginFlow;

  const containerElement = document.getElementById(effectiveContainerId);
  if (!containerElement) {
    return null;
  }

  // Reuse only when the active verifier belongs to this exact element.
  if (activeVerifier && activeContainerId === effectiveContainerId) {
    return activeVerifier;
  }

  if (activeVerifier || activeContainerId) {
    clearRecaptchaVerifier();
  }

  // Dedicated visible containers must be empty before construction. The
  // invisible login verifier is attached to the button and must not be emptied.
  if (dedicatedElement && containerElement.childNodes.length > 0) {
    containerElement.innerHTML = '';
  }

  try {
    activeVerifier = new RecaptchaVerifier(auth, effectiveContainerId, {
      size,
      callback: () => {
        // reCAPTCHA solved; signInWithPhoneNumber continues the flow.
      },
      'expired-callback': () => {
        console.warn('[WINORA] reCAPTCHA session expired.');
      },
    });
    activeContainerId = effectiveContainerId;
    activeContainerIsDedicatedElement = dedicatedElement;
    return activeVerifier;
  } catch (err) {
    activeVerifier = null;
    activeContainerId = null;
    activeContainerIsDedicatedElement = false;
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
