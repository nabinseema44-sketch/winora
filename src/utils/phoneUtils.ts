export interface CountryCodeOption {
  code: string;
  country: string;
  label: string;
  flag: string;
}

export const COUNTRY_CODES: CountryCodeOption[] = [
  { code: '+91', country: 'IN', label: 'India (+91)', flag: '🇮🇳' },
  { code: '+1', country: 'US', label: 'USA / Canada (+1)', flag: '🇺🇸' },
  { code: '+44', country: 'GB', label: 'United Kingdom (+44)', flag: '🇬🇧' },
  { code: '+971', country: 'AE', label: 'United Arab Emirates (+971)', flag: '🇦🇪' },
  { code: '+65', country: 'SG', label: 'Singapore (+65)', flag: '🇸🇬' },
  { code: '+61', country: 'AU', label: 'Australia (+61)', flag: '🇦🇺' },
  { code: '+60', country: 'MY', label: 'Malaysia (+60)', flag: '🇲🇾' },
  { code: '+63', country: 'PH', label: 'Philippines (+63)', flag: '🇵🇭' },
  { code: '+880', country: 'BD', label: 'Bangladesh (+880)', flag: '🇧🇩' },
  { code: '+977', country: 'NP', label: 'Nepal (+977)', flag: '🇳🇵' },
  { code: '+49', country: 'DE', label: 'Germany (+49)', flag: '🇩🇪' },
  { code: '+33', country: 'FR', label: 'France (+33)', flag: '🇫🇷' },
  { code: '+81', country: 'JP', label: 'Japan (+81)', flag: '🇯🇵' },
];

/**
 * Standardize phone number into E.164 format (+[country code][digits]).
 */
export function formatToE164(countryCode: string, nationalNumber: string): string {
  const digitsOnly = nationalNumber.replace(/\D/g, '');
  const cleanCode = countryCode.startsWith('+') ? countryCode : `+${countryCode}`;
  return `${cleanCode}${digitsOnly}`;
}

/**
 * Format a phone number for user-facing display with spacing.
 */
export function formatPhoneDisplay(phoneNumber: string): string {
  if (!phoneNumber) return '';
  const cleaned = phoneNumber.replace(/\s+/g, '');
  if (cleaned.startsWith('+91') && cleaned.length >= 13) {
    return `+91 ${cleaned.slice(3, 8)} ${cleaned.slice(8)}`;
  }
  if (cleaned.startsWith('+1') && cleaned.length >= 12) {
    return `+1 (${cleaned.slice(2, 5)}) ${cleaned.slice(5, 8)}-${cleaned.slice(8)}`;
  }
  return phoneNumber;
}

/**
 * Mask digits for privacy while keeping country code and last 4 digits visible.
 */
export function maskPhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) return '•••• ••••';
  const clean = phoneNumber.trim();
  if (clean.length < 8) return clean;
  const lastFour = clean.slice(-4);
  const prefix = clean.slice(0, 3);
  return `${prefix} •••• ••${lastFour}`;
}

/**
 * Basic national phone number validation (between 6 and 14 digits).
 */
export function isValidNationalNumber(number: string): boolean {
  const digits = number.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 14;
}
