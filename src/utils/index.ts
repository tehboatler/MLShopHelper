// Utility functions for MLShopHelper

/**
 * Generate a unique id (not cryptographically secure)
 */
export function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Returns a human-readable string for how many days ago a date was.
 * @param dateStr ISO string or undefined
 */
export function daysAgo(dateStr?: string): string {
  if (!dateStr) return "Never";
  const then = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "1 day ago";
  return `${diff} days ago`;
}
