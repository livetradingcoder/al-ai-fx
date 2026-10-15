// How long we keep what we log about visitors. The privacy policy states the
// same periods in words; retention.test.ts keeps the two in step.

/** An IP address (and its country) is deleted this long after we last saw it. */
export const USER_IP_RETENTION_DAYS = 365;

/** Sign-in records, which hold an IP address too, are deleted after this long unused. */
export const SESSION_RETENTION_DAYS = 365;
