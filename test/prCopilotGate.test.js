import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_WIP_TITLE_PREFIX,
  changedFilesTouchDotPath,
  isAllowedAuthor,
  isWipTitle,
  parseAuthorAllowlist
} from '../lib/prCopilotGate.js'

describe('isWipTitle', () => {
  it('returns true when title starts with default WIP prefix', () => {
    assert.equal(isWipTitle('[WIP] fix stuff', DEFAULT_WIP_TITLE_PREFIX), true)
  })

  it('returns false when title does not start with prefix', () => {
    assert.equal(isWipTitle('fix stuff', DEFAULT_WIP_TITLE_PREFIX), false)
  })

  it('respects custom prefix', () => {
    assert.equal(isWipTitle('DRAFT: x', 'DRAFT: '), true)
    assert.equal(isWipTitle('fix', 'DRAFT: '), false)
  })

  it('returns false for empty prefix', () => {
    assert.equal(isWipTitle('[WIP] x', ''), false)
  })
})

describe('isAllowedAuthor', () => {
  it('returns false when allowlist is empty', () => {
    assert.equal(isAllowedAuthor('copilot', []), false)
  })

  it('returns true when login is in allowlist', () => {
    assert.equal(isAllowedAuthor('github-copilot[bot]', ['github-copilot[bot]']), true)
  })

  it('returns false when login is missing', () => {
    assert.equal(isAllowedAuthor('', ['a']), false)
    assert.equal(isAllowedAuthor(undefined, ['a']), false)
  })
})

describe('parseAuthorAllowlist', () => {
  it('parses comma-separated logins', () => {
    assert.deepEqual(parseAuthorAllowlist('a, b ,c'), ['a', 'b', 'c'])
  })

  it('returns empty array for empty input', () => {
    assert.deepEqual(parseAuthorAllowlist(''), [])
    assert.deepEqual(parseAuthorAllowlist('   '), [])
    assert.deepEqual(parseAuthorAllowlist(undefined), [])
  })
})

describe('changedFilesTouchDotPath', () => {
  it('detects .github and .env style paths', () => {
    assert.equal(changedFilesTouchDotPath([{ filename: '.github/workflows/x.yml' }]), true)
    assert.equal(changedFilesTouchDotPath([{ filename: '.env' }]), true)
  })

  it('detects dot segment in nested path', () => {
    assert.equal(changedFilesTouchDotPath([{ filename: 'src/.local/foo' }]), true)
  })

  it('returns false for normal paths', () => {
    assert.equal(changedFilesTouchDotPath([{ filename: 'src/index.js' }]), false)
  })

  it('checks previous_filename on renames', () => {
    assert.equal(
      changedFilesTouchDotPath([
        { filename: 'public/config.json', previous_filename: '.env.local' }
      ]),
      true
    )
  })

  it('ignores . and .. as single segments only', () => {
    assert.equal(changedFilesTouchDotPath([{ filename: 'foo/../bar/baz.js' }]), false)
  })

  it('returns false for non-array', () => {
    assert.equal(changedFilesTouchDotPath(null), false)
  })
})
