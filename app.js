import dotenv from 'dotenv'
import fs from 'fs'
import http from 'http'
import { Octokit, App } from 'octokit'
import { createNodeMiddleware } from '@octokit/webhooks'
import { handleCopilotPrGate } from './lib/handleCopilotPr.js'
import {
  DEFAULT_WIP_TITLE_PREFIX,
  parseAuthorAllowlist
} from './lib/prCopilotGate.js'

// Load environment variables from .env file
dotenv.config()

// Set configured values
const appId = process.env.APP_ID
const privateKeyPath = process.env.PRIVATE_KEY_PATH
const privateKey = fs.readFileSync(privateKeyPath, 'utf8')
const secret = process.env.WEBHOOK_SECRET
const enterpriseHostname = process.env.ENTERPRISE_HOSTNAME
const messageForNewPRs = fs.readFileSync('./message.md', 'utf8')
const copilotAuthorAllowlist = parseAuthorAllowlist(process.env.COPILOT_PR_AUTHOR_LOGINS)
const wipTitlePrefix = process.env.WIP_TITLE_PREFIX ?? DEFAULT_WIP_TITLE_PREFIX

// Create an authenticated Octokit client authenticated as a GitHub App
const app = new App({
  appId,
  privateKey,
  webhooks: {
    secret
  },
  ...(enterpriseHostname && {
    Octokit: Octokit.defaults({
      baseUrl: `https://${enterpriseHostname}/api/v3`
    })
  })
})

// Optional: Get & log the authenticated app's name
const { data } = await app.octokit.request('/app')

// Read more about custom logging: https://github.com/octokit/core.js#logging
app.octokit.log.debug(`Authenticated as '${data.name}'`)

const copilotGateOptions = {
  wipPrefix: wipTitlePrefix,
  authorAllowlist: copilotAuthorAllowlist
}

async function runCopilotPrGate ({ octokit, payload }) {
  try {
    await handleCopilotPrGate(octokit, payload, copilotGateOptions)
  } catch (error) {
    if (error.response) {
      console.error(
        `Copilot PR gate error: ${error.response.status}. Message: ${error.response.data.message}`
      )
    } else {
      console.error(error)
    }
  }
}

// Welcome message on open (all PRs)
app.webhooks.on('pull_request.opened', async ({ octokit, payload }) => {
  console.log(`Received pull_request.opened for #${payload.pull_request.number}`)
  try {
    await octokit.rest.issues.createComment({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.pull_request.number,
      body: messageForNewPRs
    })
  } catch (error) {
    if (error.response) {
      console.error(`Error! Status: ${error.response.status}. Message: ${error.response.data.message}`)
    } else {
      console.error(error)
    }
  }
  await runCopilotPrGate({ octokit, payload })
})

app.webhooks.on('pull_request.edited', async ({ octokit, payload }) => {
  console.log(`Received pull_request.edited for #${payload.pull_request.number}`)
  await runCopilotPrGate({ octokit, payload })
})

app.webhooks.on('pull_request.synchronize', async ({ octokit, payload }) => {
  console.log(`Received pull_request.synchronize for #${payload.pull_request.number}`)
  await runCopilotPrGate({ octokit, payload })
})

// Optional: Handle errors
app.webhooks.onError((error) => {
  if (error.name === 'AggregateError') {
    // Log Secret verification errors
    console.log(`Error processing request: ${error.event}`)
  } else {
    console.log(error)
  }
})

// Launch a web server to listen for GitHub webhooks
const port = process.env.PORT || 3000
const path = '/api/webhook'
const localWebhookUrl = `http://localhost:${port}${path}`

// See https://github.com/octokit/webhooks.js/#createnodemiddleware for all options
const middleware = createNodeMiddleware(app.webhooks, { path })

http.createServer(middleware).listen(port, () => {
  console.log(`Server is listening for events at: ${localWebhookUrl}`)
  console.log('Press Ctrl + C to quit.')
})
