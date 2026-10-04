/** Reuse locale-aware, case- and accent-insensitive ordering for popup labels. */
export const compareText = new Intl.Collator(undefined, { sensitivity: 'base' }).compare
