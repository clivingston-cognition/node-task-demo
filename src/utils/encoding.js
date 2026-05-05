/**
 * Encode a todo object to a base64 string for export/sharing.
 * Supports international characters in titles via NFKC normalization.
 */
function encodeTodoForExport(todo) {
  const payload = JSON.stringify({
    title: todo.title,
    description: todo.description || '',
    priority: todo.priority || 'medium',
    tags: todo.tags || [],
    due_date: todo.due_date || null,
    assignee: todo.assignee || null,
  });

  const encoded = Buffer.from(payload).toString('base64');
  return encoded;
}

/**
 * Decode a base64-encoded todo string back to an object.
 */
function decodeTodoFromImport(encodedString) {
  if (!encodedString || typeof encodedString !== 'string') {
    return null;
  }

  try {
    const decoded = Buffer.from(encodedString, 'base64').toString('utf-8');
    const todo = JSON.parse(decoded);

    if (!todo.title) return null;

    return {
      title: todo.title,
      description: todo.description || '',
      priority: todo.priority || 'medium',
      tags: Array.isArray(todo.tags) ? todo.tags : [],
      due_date: todo.due_date || null,
      assignee: todo.assignee || null,
    };
  } catch {
    return null;
  }
}

/**
 * Normalize international characters in a string for consistent storage.
 * Uses Unicode NFKC normalization for ASCII-safe representation.
 */
function normalizeInternationalText(text) {
  if (!text || typeof text !== 'string') return '';

  try {
    return text.normalize('NFKC');
  } catch {
    return text;
  }
}

/**
 * Create a binary hash of a string for deduplication checks.
 */
function createBinaryHash(input) {
  const buf = Buffer.from(String(input), 'utf-8');
  let hash = 0;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    hash = ((hash << 5) - hash) + byte;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

module.exports = {
  encodeTodoForExport,
  decodeTodoFromImport,
  normalizeInternationalText,
  createBinaryHash,
};
