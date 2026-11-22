#!/usr/bin/env node
// Builds the scope of a code review as ONE file: every touched file in full,
// numbered on the NEW file, each changed line marked. Each reviewer reads it once,
// instead of every reviewer rebuilding the same scope hunk by hunk.
//
// There is deliberately no size cap: one read of the bundle costs less than a
// scope rebuilt piecemeal. The guard lives elsewhere: each reviewer declares how
// much of the bundle it covered.
//
// Usage:
//   node build-bundle.mjs [--scope <scope>] [--repo <dir>]
//                         [--list-only <prefix,...>] [--out <file>]
//
//   --scope      working-tree (default): uncommitted changes against HEAD, untracked files included.
//                <ref>: everything from <ref> to the working tree, untracked files included.
//                <A>..<B> or <A>...<B>: the commits of that range.
//   --repo       root of the repository or worktree to read (default: .).
//   --list-only  path prefixes listed in the manifest without their content.
//   --out        write the bundle there and print a summary line on stderr;
//                without it, the bundle goes to stdout.

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const LABELS = { A: 'added', M: 'modified', D: 'deleted', R: 'renamed', C: 'copied', T: 'type changed' }

function parseArgs(argv) {
  const out = { scope: 'working-tree', repo: '.', listOnly: [], out: null }
  const list = (value) =>
    value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  for (let i = 0; i < argv.length; i += 2) {
    const [key, value] = [argv[i], argv[i + 1]]
    if (value === undefined) {
      throw new Error(`missing value for ${key}`)
    }
    if (key === '--scope') {
      out.scope = value
    } else if (key === '--repo') {
      out.repo = value
    } else if (key === '--out') {
      out.out = value
    } else if (key === '--list-only') {
      out.listOnly = list(value).map((p) => p.replace(/\/+$/, ''))
    } else {
      throw new Error(`unknown option: ${key}`)
    }
  }
  return out
}

function git(repo, args) {
  return execFileSync('git', ['-C', repo, '-c', 'core.quotePath=false', ...args], {
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  })
}

function gitOrEmpty(repo, args) {
  try {
    return git(repo, args)
  } catch {
    return ''
  }
}

const isRange = (scope) => scope.includes('..')
// The commit a working-tree scope is compared against.
const baseOf = (scope) => (scope === 'working-tree' ? 'HEAD' : scope)

function parseNameStatus(raw) {
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, ...paths] = line.split('\t')
      return { status: status[0], path: paths[paths.length - 1] }
    })
}

function changedFiles(repo, scope) {
  if (isRange(scope)) {
    return parseNameStatus(git(repo, ['diff', '--no-color', '--name-status', scope]))
  }
  const tracked = parseNameStatus(git(repo, ['diff', '--no-color', '--name-status', baseOf(scope)]))
  const untracked = git(repo, ['ls-files', '--others', '--exclude-standard'])
    .split('\n')
    .filter(Boolean)
    .map((path) => ({ status: 'A', path }))
  return [...tracked, ...untracked]
}

function hunks({ repo, scope }, path) {
  const against = isRange(scope) ? scope : baseOf(scope)
  const raw = gitOrEmpty(repo, ['diff', '--no-color', '--no-ext-diff', '-U0', against, '--', path])
  const touched = new Set()
  const removed = []
  let count = 0
  for (const line of raw.split('\n')) {
    const head = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/)
    if (head) {
      count += 1
      const start = Number(head[1])
      const span = head[2] === undefined ? 1 : Number(head[2])
      for (let n = start; n < start + span; n += 1) {
        touched.add(n)
      }
      continue
    }
    // Past the first hunk header, a `-` line is a removal even when it reads `---`.
    if (count > 0 && line.startsWith('-')) {
      removed.push(line.slice(1))
    }
  }
  return { touched, removed, count }
}

function newContent({ repo, scope }, { path, status }) {
  if (status === 'D') {
    return null
  }
  if (!isRange(scope)) {
    try {
      return readFileSync(join(repo, path), 'utf8')
    } catch {
      return null
    }
  }
  const head = scope.slice(scope.lastIndexOf('..') + 2) || 'HEAD'
  return gitOrEmpty(repo, ['show', `${head}:${path}`]) || null
}

function contentLines(content) {
  if (content === null) {
    return []
  }
  const lines = content.split('\n')
  if (lines.length && lines[lines.length - 1] === '') {
    lines.pop()
  }
  return lines
}

// Why a file is listed without its content, or null when the bundle carries it.
function omission(entry, listOnly) {
  if (listOnly.some((p) => entry.path === p || entry.path.startsWith(`${p}/`))) {
    return 'listed only'
  }
  if (entry.status === 'D') {
    return entry.removed.length ? null : 'deleted, no text content'
  }
  if (entry.content === null) {
    return 'unreadable'
  }
  if (entry.content.includes('\u0000')) {
    return 'binary'
  }
  return null
}

function renderFile(entry, { index, total }) {
  const { status, path, touched, removed, count, content } = entry
  const lines = contentLines(content)
  const header = `===== ${index}/${total} · ${LABELS[status] || status} · ${path} · ${lines.length} lines · ${count} hunk(s) · ${touched.size} changed line(s) =====`
  if (status === 'D') {
    return [header, '  (file deleted: its removed lines follow)', ...removed.map((l) => `  - | ${l}`)].join('\n')
  }
  const width = String(lines.length).length
  const body = lines.map((text, i) => `${touched.has(i + 1) ? '>' : ' '} ${String(i + 1).padStart(width)} | ${text}`)
  const dropped = removed.length
    ? ['', `  ${removed.length} line(s) removed by this change:`, ...removed.map((l) => `  - | ${l}`)]
    : []
  return [header, ...body, ...dropped].join('\n')
}

const opts = parseArgs(process.argv.slice(2))

const entries = changedFiles(opts.repo, opts.scope)
  .sort((a, b) => a.path.localeCompare(b.path))
  .map((file) => {
    const { touched, removed, count } = hunks(opts, file.path)
    const content = newContent(opts, file)
    // An untracked file shows up in no diff: without this, it would come out with
    // zero changed lines although every line of it is new.
    if (file.status === 'A' && touched.size === 0 && content !== null) {
      for (let n = 1; n <= contentLines(content).length; n += 1) {
        touched.add(n)
      }
    }
    return { ...file, touched, removed, count, content }
  })
  .map((entry) => ({ ...entry, omitted: omission(entry, opts.listOnly) }))

const reviewable = entries.filter((e) => !e.omitted)
const totalLines = reviewable.reduce((sum, e) => sum + contentLines(e.content).length, 0)
const statusCounts = {}
for (const e of entries) {
  statusCounts[e.status] = (statusCounts[e.status] || 0) + 1
}
const byStatus = Object.entries(statusCounts).map(([status, n]) => `${n} ${LABELS[status] || status}`)

const manifest = [
  '# Review bundle',
  '',
  `- Scope: ${opts.scope}`,
  `- Repository: ${opts.repo}`,
  `- Files: ${entries.length}${byStatus.length ? ` (${byStatus.join(', ')})` : ''}`,
  `- Reviewable files: ${reviewable.length}, with ${totalLines} content lines`,
  '',
  'Every reviewable file appears IN FULL below, numbered on the NEW file.',
  'A line prefixed with `>` was changed by this change; the other lines are context.',
  'Anchor every finding on these line numbers.',
  'Files marked `not included` are listed here without their content.',
  '',
  '## Files',
  '',
  ...entries.map(
    (e, i) =>
      `${i + 1}. ${e.status} ${e.path} (${e.touched.size} changed line(s))${e.omitted ? ` · not included: ${e.omitted}` : ''}`,
  ),
  '',
].join('\n')

const body = reviewable.map((e, i) => renderFile(e, { index: i + 1, total: reviewable.length })).join('\n\n')
const bundle = `${manifest}\n${body}\n`

if (opts.out) {
  mkdirSync(dirname(opts.out), { recursive: true })
  writeFileSync(opts.out, bundle)
  process.stderr.write(
    `${opts.out} · ${entries.length} files · ${reviewable.length} reviewable · ${totalLines} lines · ${Math.round(bundle.length / 1024)} kB\n`,
  )
} else {
  process.stdout.write(bundle)
}
