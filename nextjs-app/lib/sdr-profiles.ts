/**
 * SDR Profile Mapping
 *
 * Maps SDR first names (used in mock data) to their full profiles.
 * Used to display avatars and full names in the UI.
 */

export interface SDRProfile {
  firstName: string;
  lastName: string;
  fullName: string;
  avatar: string;
}

export const SDR_PROFILES: Record<string, SDRProfile> = {
  Ryan: {
    firstName: 'Ryan',
    lastName: 'Hemelt',
    fullName: 'Ryan Hemelt',
    avatar: '/profpic.jpeg',
  },
  Sarah: {
    firstName: 'Sarah',
    lastName: 'Chen',
    fullName: 'Sarah Chen',
    avatar: 'https://vercel.com/api/www/avatar?u=shuding&s=64',
  },
  Michael: {
    firstName: 'Michael',
    lastName: 'Park',
    fullName: 'Michael Park',
    avatar: 'https://vercel.com/api/www/avatar?u=timer&s=64',
  },
  Jessica: {
    firstName: 'Jessica',
    lastName: 'Taylor',
    fullName: 'Jessica Taylor',
    avatar: 'https://vercel.com/api/www/avatar?u=lydiahallie&s=64',
  },
};

/**
 * Get SDR profile by first name
 * Returns undefined if not found
 */
export function getSDRProfile(firstName: string): SDRProfile | undefined {
  return SDR_PROFILES[firstName];
}

/**
 * Get SDR avatar URL by first name
 * Returns a default placeholder if not found
 */
export function getSDRAvatarUrl(firstName: string): string {
  const profile = SDR_PROFILES[firstName];
  return profile?.avatar ?? '/profpic.jpeg';
}
