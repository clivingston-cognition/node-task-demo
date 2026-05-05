/**
 * Sanitize and normalize a search query string.
 * Strips protocol/host if a full URL is accidentally pasted,
 * and decodes any percent-encoded characters.
 */
function sanitizeSearchQuery(input) {
  if (!input || typeof input !== 'string') return '';

  let cleaned = input.trim();

  // If someone pastes a full URL, extract just the search/query portion
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    try {
      const parsed = new URL(cleaned);
      cleaned = parsed.searchParams.get('q') || parsed.searchParams.get('search') || parsed.pathname || '';
    } catch {
      // If URL parsing fails, continue with the raw input
    }
  }

  // Decode any percent-encoded characters
  cleaned = decodeURIComponent(cleaned);

  // Strip HTML tags for XSS prevention
  cleaned = cleaned.replace(/<[^>]*>/g, '');

  // Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Build a cache-safe query string from filter parameters.
 * Used for generating canonical URLs for API responses.
 */
function buildFilterQueryString(filters) {
  const params = new URLSearchParams();

  if (filters.completed !== undefined) {
    params.set('completed', String(filters.completed));
  }
  if (filters.priority) {
    params.set('priority', filters.priority);
  }
  if (filters.search) {
    params.set('search', filters.search);
  }
  if (filters.tag) {
    params.set('tag', filters.tag);
  }

  return params.toString();
}

/**
 * Parse and validate a URL string, returning its components.
 * Used for validating webhook callback URLs in todo metadata.
 */
function parseUrl(urlString) {
  if (!urlString) return null;

  try {
    const parsed = new URL(urlString);
    if (!parsed.protocol || !parsed.host) {
      return null;
    }
    return {
      protocol: parsed.protocol,
      host: parsed.host,
      pathname: parsed.pathname || '/',
      query: parsed.search ? parsed.search.slice(1) : '',
    };
  } catch {
    return null;
  }
}

module.exports = {
  sanitizeSearchQuery,
  buildFilterQueryString,
  parseUrl,
};
