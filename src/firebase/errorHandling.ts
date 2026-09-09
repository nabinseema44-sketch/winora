export type OperationType = 'create' | 'read' | 'update' | 'delete' | 'list' | 'auth';

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path?: string;
  details?: unknown;
}

/**
 * Standardized error handler for Firebase and Firestore calls.
 * Logs full contextual details to the developer console while returning
 * clean, user-friendly feedback.
 */
export function handleFirebaseError(
  error: unknown,
  operationType: OperationType,
  path?: string
): FirestoreErrorInfo {
  const err = error as { code?: string; message?: string };
  const errorCode = err?.code || 'unknown-error';
  const errorMessage = err?.message || 'An unexpected error occurred.';

  const info: FirestoreErrorInfo = {
    error: `[${errorCode}] ${errorMessage}`,
    operationType,
    path,
    details: error,
  };

  console.error(
    `[WINORA Firebase Error] Operation: ${operationType} | Target: ${path ?? 'N/A'} | Error:`,
    info
  );

  return info;
}

/**
 * Maps raw Firebase Authentication error codes to clear, actionable,
 * and user-friendly error messages.
 */
export function getAuthErrorMessage(error: unknown): string {
  const err = error as { code?: string; message?: string };
  const code = err?.code || '';

  switch (code) {
    case 'auth/invalid-phone-number':
      return 'Invalid mobile number. Please check the country code and number format (e.g., +91 98765 43210).';
    case 'auth/missing-phone-number':
      return 'Please enter a valid mobile number.';
    case 'auth/invalid-verification-code':
      return 'Invalid 6-digit OTP code. Please check the code sent to your mobile phone.';
    case 'auth/code-expired':
      return 'The OTP verification code has expired. Please request a new SMS code.';
    case 'auth/quota-exceeded':
      return 'SMS quota exceeded for this Firebase project. Please try again later or contact administrator.';
    case 'auth/captcha-check-failed':
      return 'Security verification check failed. Please refresh the page and try again.';
    case 'auth/credential-already-in-use':
      return 'This mobile number is already linked to another WINORA account.';
    case 'auth/provider-already-linked':
      return 'This mobile number is already linked to your account.';
    case 'auth/invalid-credential':
      return 'Invalid credentials or code. Please verify your details and try again.';
    case 'auth/user-not-found':
      return 'No registered WINORA account was found.';
    case 'auth/wrong-password':
      return 'Incorrect credentials. Please verify and try again.';
    case 'auth/email-already-in-use':
      return 'An account already exists with these credentials.';
    case 'auth/invalid-email':
      return 'Please enter a valid email format.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters.';
    case 'auth/user-disabled':
      return 'This WINORA player account has been suspended. Please contact support.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Access is temporarily restricted. Please wait 1-2 minutes and try again.';
    case 'auth/network-request-failed':
      return 'Network connection error. Please check your internet connectivity.';
    case 'auth/operation-not-allowed': {
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('region') || msg.includes('sms unable')) {
        return 'SMS region blocked: This country code is not enabled in your Firebase project SMS region policy. Please enable it in Firebase Console (Authentication > Settings > SMS region policy), or use a Firebase test phone number.';
      }
      return 'Phone Authentication is disabled in your Firebase Console. Please enable the Phone provider under Authentication > Sign-in method.';
    }
    default:
      return err?.message || 'Authentication operation failed. Please verify your details and try again.';
  }
}

/**
 * Detects if an error is specifically caused by Firebase's SMS Region Policy restriction.
 */
export function isSmsRegionPolicyError(errorText: string | null | undefined): boolean {
  if (!errorText) return false;
  const lower = errorText.toLowerCase();
  return (
    lower.includes('region') ||
    lower.includes('sms unable') ||
    lower.includes('sms region')
  );
}
