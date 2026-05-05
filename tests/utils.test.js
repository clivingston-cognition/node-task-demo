const {
  generateSessionToken,
  validateSessionToken,
  hashContent,
} = require('../src/utils/crypto');
const {
  encodeTodoForExport,
  decodeTodoFromImport,
  normalizeInternationalText,
  createBinaryHash,
} = require('../src/utils/encoding');
const {
  sanitizeSearchQuery,
  buildFilterQueryString,
  parseUrl,
} = require('../src/utils/sanitizer');

describe('crypto utils', () => {
  describe('generateSessionToken', () => {
    test('returns an iv:ciphertext formatted string', () => {
      const token = generateSessionToken('user-1');

      expect(typeof token).toBe('string');
      const parts = token.split(':');
      expect(parts).toHaveLength(2);
      // iv is 16 bytes hex-encoded -> 32 chars
      expect(parts[0]).toMatch(/^[0-9a-f]{32}$/);
      expect(parts[1]).toMatch(/^[0-9a-f]+$/);
    });

    test('produces different tokens for the same session due to random IV', () => {
      const a = generateSessionToken('same-session');
      const b = generateSessionToken('same-session');

      expect(a).not.toEqual(b);
      expect(a.split(':')[0]).not.toEqual(b.split(':')[0]);
    });
  });

  describe('validateSessionToken', () => {
    test('decodes a freshly issued token to its session id', () => {
      const sessionId = 'abc-123';
      const token = generateSessionToken(sessionId);

      const decoded = validateSessionToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded.sessionId).toBe(sessionId);
      expect(typeof decoded.timestamp).toBe('number');
      expect(decoded.timestamp).toBeLessThanOrEqual(Date.now());
    });

    test('returns null for null, undefined or empty input', () => {
      expect(validateSessionToken(null)).toBeNull();
      expect(validateSessionToken(undefined)).toBeNull();
      expect(validateSessionToken('')).toBeNull();
    });

    test('returns null for non-string input', () => {
      expect(validateSessionToken(12345)).toBeNull();
      expect(validateSessionToken({})).toBeNull();
      expect(validateSessionToken([])).toBeNull();
    });

    test('returns null for malformed tokens (wrong number of parts)', () => {
      expect(validateSessionToken('no-colons-at-all')).toBeNull();
      expect(validateSessionToken('a:b:c')).toBeNull();
    });

    test('returns null for token with invalid IV or ciphertext', () => {
      expect(validateSessionToken('zz:not-real-cipher-text')).toBeNull();
      expect(validateSessionToken('00112233445566778899aabbccddeeff:zz')).toBeNull();
    });

    test('returns null for tokens older than 24 hours', () => {
      const realNow = Date.now;
      const twoDaysAgo = realNow() - 48 * 60 * 60 * 1000;

      Date.now = () => twoDaysAgo;
      const oldToken = generateSessionToken('expired-session');
      Date.now = realNow;

      expect(validateSessionToken(oldToken)).toBeNull();
    });
  });

  describe('hashContent', () => {
    test('produces a 64-character lowercase hex sha256 digest', () => {
      const hash = hashContent('hello world');

      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    test('is deterministic for the same content', () => {
      expect(hashContent('payload')).toBe(hashContent('payload'));
    });

    test('produces different hashes for different content', () => {
      expect(hashContent('a')).not.toBe(hashContent('b'));
    });

    test('coerces non-string input to a string', () => {
      expect(hashContent(123)).toBe(hashContent('123'));
      expect(hashContent(null)).toBe(hashContent('null'));
    });
  });
});

describe('encoding utils', () => {
  describe('encodeTodoForExport', () => {
    test('encodes a complete todo as base64 JSON', () => {
      const todo = {
        title: 'Buy milk',
        description: 'Whole, 2L',
        priority: 'high',
        tags: ['groceries'],
        due_date: '2025-01-15',
      };

      const encoded = encodeTodoForExport(todo);
      const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'));
      expect(decoded).toEqual(todo);
    });

    test('substitutes defaults for missing optional fields', () => {
      const encoded = encodeTodoForExport({ title: 'Bare minimum' });
      const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'));

      expect(decoded).toEqual({
        title: 'Bare minimum',
        description: '',
        priority: 'medium',
        tags: [],
        due_date: null,
      });
    });
  });

  describe('decodeTodoFromImport', () => {
    test('decodes an export payload back to a todo object', () => {
      const original = {
        title: 'Buy milk',
        description: '',
        priority: 'medium',
        tags: ['groceries'],
        due_date: '2025-01-15',
      };
      const encoded = encodeTodoForExport(original);

      expect(decodeTodoFromImport(encoded)).toEqual(original);
    });

    test('round-trips missing optional fields with defaults', () => {
      const encoded = encodeTodoForExport({ title: 'Round trip' });

      expect(decodeTodoFromImport(encoded)).toEqual({
        title: 'Round trip',
        description: '',
        priority: 'medium',
        tags: [],
        due_date: null,
      });
    });

    test('returns null for null, undefined, or empty input', () => {
      expect(decodeTodoFromImport(null)).toBeNull();
      expect(decodeTodoFromImport(undefined)).toBeNull();
      expect(decodeTodoFromImport('')).toBeNull();
    });

    test('returns null for non-string input', () => {
      expect(decodeTodoFromImport(123)).toBeNull();
      expect(decodeTodoFromImport({})).toBeNull();
    });

    test('returns null for invalid base64 / JSON', () => {
      const garbage = Buffer.from('not-valid-json').toString('base64');
      expect(decodeTodoFromImport(garbage)).toBeNull();
    });

    test('returns null when decoded payload has no title', () => {
      const encoded = Buffer.from(JSON.stringify({ description: 'no title' })).toString('base64');
      expect(decodeTodoFromImport(encoded)).toBeNull();
    });

    test('coerces tags to empty array if not an array', () => {
      const encoded = Buffer.from(
        JSON.stringify({ title: 'No tag array', tags: 'oops' }),
      ).toString('base64');

      const decoded = decodeTodoFromImport(encoded);
      expect(decoded.tags).toEqual([]);
    });
  });

  describe('normalizeInternationalText', () => {
    test('returns NFKC-normalized form for composed characters', () => {
      // Decomposed e + combining acute -> composed é
      const decomposed = 'caf\u0065\u0301';
      const composed = 'caf\u00e9';

      expect(normalizeInternationalText(decomposed)).toBe(composed);
    });

    test('returns empty string for null, undefined, or non-string input', () => {
      expect(normalizeInternationalText(null)).toBe('');
      expect(normalizeInternationalText(undefined)).toBe('');
      expect(normalizeInternationalText(42)).toBe('');
      expect(normalizeInternationalText('')).toBe('');
    });

    test('passes through plain ASCII unchanged', () => {
      expect(normalizeInternationalText('hello')).toBe('hello');
    });
  });

  describe('createBinaryHash', () => {
    test('returns a non-empty hex string', () => {
      expect(createBinaryHash('something')).toMatch(/^[0-9a-f]+$/);
    });

    test('is deterministic for the same input', () => {
      expect(createBinaryHash('repeat')).toBe(createBinaryHash('repeat'));
    });

    test('produces different hashes for different inputs', () => {
      expect(createBinaryHash('a')).not.toBe(createBinaryHash('b'));
    });

    test('handles empty string input', () => {
      expect(typeof createBinaryHash('')).toBe('string');
    });
  });
});

describe('sanitizer utils', () => {
  describe('sanitizeSearchQuery', () => {
    test('returns empty string for null, undefined, or non-string', () => {
      expect(sanitizeSearchQuery(null)).toBe('');
      expect(sanitizeSearchQuery(undefined)).toBe('');
      expect(sanitizeSearchQuery(123)).toBe('');
      expect(sanitizeSearchQuery('')).toBe('');
    });

    test('trims and collapses internal whitespace', () => {
      expect(sanitizeSearchQuery('  hello   world  ')).toBe('hello world');
    });

    test('strips HTML tags but preserves their text content', () => {
      // The regex /<[^>]*>/g removes only the angle-bracketed tags,
      // not the text between opening and closing tags.
      expect(sanitizeSearchQuery('<script>alert(1)</script>find me')).toBe('alert(1)find me');
      expect(sanitizeSearchQuery('plain <b>bold</b> text')).toBe('plain bold text');
    });

    test('decodes percent-encoded characters', () => {
      expect(sanitizeSearchQuery('hello%20world')).toBe('hello world');
    });

    test('extracts q parameter from a full URL', () => {
      expect(sanitizeSearchQuery('https://example.com/search?q=cats')).toBe('cats');
    });

    test('falls back to search parameter when q is missing', () => {
      expect(sanitizeSearchQuery('https://example.com/path?search=dogs')).toBe('dogs');
    });

    test('falls back to pathname when no query params', () => {
      expect(sanitizeSearchQuery('https://example.com/some/path')).toBe('/some/path');
    });

    test('falls through when URL parsing throws', () => {
      // Looks like a URL but cannot be parsed -> the catch block runs
      // and the original string is processed normally.
      const result = sanitizeSearchQuery('http://[bad');
      expect(typeof result).toBe('string');
    });
  });

  describe('buildFilterQueryString', () => {
    test('serializes all known filter fields', () => {
      const qs = buildFilterQueryString({
        completed: true,
        priority: 'high',
        search: 'foo',
        tag: 'work',
      });

      const params = new URLSearchParams(qs);
      expect(params.get('completed')).toBe('true');
      expect(params.get('priority')).toBe('high');
      expect(params.get('search')).toBe('foo');
      expect(params.get('tag')).toBe('work');
    });

    test('returns an empty string for an empty filter object', () => {
      expect(buildFilterQueryString({})).toBe('');
    });

    test('serializes completed=false correctly', () => {
      const qs = buildFilterQueryString({ completed: false });
      expect(qs).toBe('completed=false');
    });

    test('omits fields that are not provided', () => {
      const qs = buildFilterQueryString({ priority: 'low' });
      const params = new URLSearchParams(qs);
      expect(params.get('priority')).toBe('low');
      expect(params.has('completed')).toBe(false);
      expect(params.has('search')).toBe(false);
      expect(params.has('tag')).toBe(false);
    });
  });

  describe('parseUrl', () => {
    test('returns null for null, undefined, or empty input', () => {
      expect(parseUrl(null)).toBeNull();
      expect(parseUrl(undefined)).toBeNull();
      expect(parseUrl('')).toBeNull();
    });

    test('returns null for malformed URLs', () => {
      expect(parseUrl('not a url')).toBeNull();
      expect(parseUrl('://missing-protocol')).toBeNull();
    });

    test('returns null when URL has no host (e.g. file://)', () => {
      // file:///tmp/x parses but has empty host
      expect(parseUrl('file:///tmp/x')).toBeNull();
    });

    test('returns components for a fully-formed URL', () => {
      expect(parseUrl('https://example.com/foo/bar?baz=1')).toEqual({
        protocol: 'https:',
        host: 'example.com',
        pathname: '/foo/bar',
        query: 'baz=1',
      });
    });

    test('returns / pathname when URL has no path component', () => {
      expect(parseUrl('https://example.com')).toEqual({
        protocol: 'https:',
        host: 'example.com',
        pathname: '/',
        query: '',
      });
    });

    test('strips the leading ? from query', () => {
      const result = parseUrl('https://example.com/?a=b&c=d');
      expect(result.query).toBe('a=b&c=d');
    });
  });
});
