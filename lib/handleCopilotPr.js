import {
  SKIP_AUTOMATION_MARKER,
  changedFilesTouchDotPath,
  isAllowedAuthor,
  isWipTitle
} from './prCopilotGate.js'

const DEFAULT_SKIP_BODY =
  '**Preator:** This pull request changes paths that include a dot-prefixed file or directory (for example `.github` or `.env`). Automated steps (marking ready for review and approving pending workflow runs) will **not** run for this PR.'

/**
 * @param {*} octokit installation-scoped Octokit from @octokit/webhooks
 * @param {*} payload pull_request webhook payload
 * @param {{ wipPrefix?: string, authorAllowlist: string[], skipAutomationVisibleBody?: string }} options
 */
export async function handleCopilotPrGate (octokit, payload, options) {
  const { wipPrefix, authorAllowlist, skipAutomationVisibleBody } = options
  const pr = payload.pull_request
  const owner = payload.repository.owner.login
  const repo = payload.repository.name
  const pullNumber = pr.number

  if (isWipTitle(pr.title, wipPrefix)) return

  const login = pr.user?.login
  if (!isAllowedAuthor(login, authorAllowlist)) return

  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100
  })

  if (changedFilesTouchDotPath(files)) {
    await postSkipAutomationCommentOnce(octokit, {
      owner,
      repo,
      pullNumber,
      visibleBody: skipAutomationVisibleBody ?? DEFAULT_SKIP_BODY
    })
    return
  }

  if (pr.draft) {
    try {
      await octokit.rest.pulls.update({
        owner,
        repo,
        pull_number: pullNumber,
        draft: false
      })
    } catch (error) {
      logOctokitError('pulls.update (draft false)', error)
    }
  }

  await approveWaitingWorkflowRuns(octokit, { owner, repo, headSha: pr.head.sha })
}

async function postSkipAutomationCommentOnce (octokit, { owner, repo, pullNumber, visibleBody }) {
  try {
    const comments = await octokit.paginate(octokit.rest.issues.listComments, {
      owner,
      repo,
      issue_number: pullNumber,
      per_page: 100
    })
    if (comments.some((c) => c.body?.includes(SKIP_AUTOMATION_MARKER))) return

    const body = `${visibleBody}\n\n${SKIP_AUTOMATION_MARKER}`
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: pullNumber,
      body
    })
  } catch (error) {
    logOctokitError('issues (skip automation comment)', error)
  }
}

async function approveWaitingWorkflowRuns (octokit, { owner, repo, headSha }) {
  try {
    const runs = await octokit.paginate(octokit.rest.actions.listWorkflowRunsForRepo, {
      owner,
      repo,
      head_sha: headSha,
      event: 'pull_request',
      status: 'waiting',
      per_page: 100
    })

    for (const run of runs) {
      if (run.status !== 'waiting') continue
      try {
        await octokit.rest.actions.approveWorkflowRun({
          owner,
          repo,
          run_id: run.id
        })
      } catch (error) {
        logOctokitError(`actions.approveWorkflowRun run_id=${run.id}`, error)
      }
    }
  } catch (error) {
    logOctokitError('actions.listWorkflowRunsForRepo', error)
  }
}

function logOctokitError (context, error) {
  if (error.response) {
    console.error(
      `[handleCopilotPrGate] ${context}: ${error.response.status} ${error.response.data?.message ?? ''}`
    )
  } else {
    console.error(`[handleCopilotPrGate] ${context}:`, error)
  }
}
