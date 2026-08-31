/**
 * Parses an ISO datetime string into a Date object.
 * Ensures UTC timestamps are correctly recognized.
 */
export const parseIsoDate = (isoString: string): Date => {
  if (!isoString) return new Date();
  // Ensure ISO strings with 'T' have a timezone indicator if none was provided
  const normalized = (isoString.endsWith('Z') || isoString.includes('+') || (isoString.includes('-') && isoString.lastIndexOf('-') > 7))
    ? isoString
    : (isoString.includes('T') ? `${isoString}Z` : isoString);
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? new Date(isoString) : d;
};

/**
 * Formats an ISO datetime string in the user's local timezone.
 * e.g., "2026-08-31T15:30:00Z" -> "Aug 31, 2026", "9:00 PM", "Aug 31, 2026, 9:00 PM"
 */
export const formatNaiveDateTime = (isoString: string): { date: string; time: string; full: string } => {
  if (!isoString) return { date: '', time: '', full: '' };
  
  const dateObj = parseIsoDate(isoString);
  if (isNaN(dateObj.getTime())) {
    return { date: isoString, time: isoString, full: isoString };
  }
  
  // Format Date: e.g., "Aug 31, 2026"
  const formattedDate = dateObj.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
  
  // Format Time: e.g., "9:00 PM"
  const formattedTime = dateObj.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  
  return {
    date: formattedDate,
    time: formattedTime,
    full: `${formattedDate}, ${formattedTime}`
  };
};

/**
 * Parses an ISO datetime string and returns a local Date object.
 */
export const getNaiveDate = (isoString: string): Date => {
  return parseIsoDate(isoString);
};

