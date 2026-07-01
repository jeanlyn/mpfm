import { Connection } from '../types';

export const isSameConnection = (
  a: Connection | null | undefined,
  b: Connection | null | undefined
): boolean => {
  if (!a || !b) return a === b;
  return a.id === b.id && a.config?.bucket === b.config?.bucket;
};
