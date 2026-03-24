/** Default WIP prefix: PRs whose title starts with this are treated as in progress. */
export const DEFAULT_WIP_TITLE_PREFIX = '[WIP] '

/** Hidden marker so we do not post duplicate skip comments. */
export const SKIP_AUTOMATION_MARKER = '<!-- preator:skip-automation-v1 -->'

export function isWipTitle (title, prefix = DEFAULT_WIP_TITLE_PREFIX) {
  if (typeof title !== 'string' || typeof prefix !== 'string' || prefix.length === 0) {
    return false
  }
  return title.startsWith(prefix)
}

export function isAllowedAuthor (login, allowlist) {
  if (!login || !Array.isArray(allowlist) || allowlist.length === 0) return false
  return allowlist.includes(login)
}

function pathTouchesDotSegment (path) {
  if (!path || typeof path !== 'string') return false
  return path.split('/').some(
    (segment) => segment.startsWith('.') && segment !== '.' && segment !== '..'
  )
}

/**
 * @param {Array<{ filename?: string, previous_filename?: string }>} files
 */
export function changedFilesTouchDotPath (files) {
  if (!Array.isArray(files)) return false
  for (const f of files) {
    if (pathTouchesDotSegment(f.filename)) return true
    if (pathTouchesDotSegment(f.previous_filename)) return true
  }
  return false
}

export function parseAuthorAllowlist (envString) {
  if (!envString || typeof envString !== 'string' || !envString.trim()) return []
  return envString.split(',').map((s) => s.trim()).filter(Boolean)
}
