import { createId } from '@paralleldrive/cuid2';

export function generateFormattedID(prefix: string): string {
  return `${prefix}-${createId()}`;
}
