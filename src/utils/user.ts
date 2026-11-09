import type { User } from '../types/dsa';

/** Display name for a user: their full name, else the local part of their email. */
export const displayName = (user?: Pick<User, 'full_name' | 'email'> | null): string => {
  const name = user?.full_name?.trim();
  if (name) return name;
  const local = user?.email?.split('@')[0]?.trim();
  return local || 'You';
};
