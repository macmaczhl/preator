# Preator GitHub App

This sample app showcases how webhooks can be used with a GitHub App's installation token to create a bot that responds to pull requests. Code uses [octokit.js](https://github.com/octokit/octokit.js).

## Requirements

- Node.js 20 or higher
- A GitHub App subscribed to **Pull request** events (`opened`, `edited`, `synchronize`) and with the following permissions:
  - Pull requests: Read & write
  - Issues: Read & write (comments on pull requests)
  - Actions: Read & write (approve workflow runs waiting on maintainer approval)
  - Metadata: Read-only
- (For local development) A tunnel to expose your local server to the internet (e.g. [smee](https://smee.io/), [ngrok](https://ngrok.com/) or [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/tunnel-guide/local/))
- Your GitHub App Webhook must be configured to receive events at a URL that is accessible from the internet.

## Setup

1. Clone this repository.
2. Create a `.env` file similar to [`.env.sample`](.env.sample) and set actual values. If you are using GitHub Enterprise Server, also include a `ENTERPRISE_HOSTNAME` variable and set the value to the name of your GitHub Enterprise Server instance.
3. Install dependencies with `npm install`.
4. Start the server with `npm run server`.
5. Ensure your server is reachable from the internet.
    - If you are using `smee`, run `smee -u <smee_url> -t http://localhost:3000/api/webhook`.
6. Ensure your GitHub App includes at least one repository on its installations.

### Copilot PR gate (optional)

Set `COPILOT_PR_AUTHOR_LOGINS` to a comma-separated list of PR author logins that should be treated as GitHub Copilot (match `pull_request.user.login` from the webhook or API). If this is unset or empty, the gate does nothing.

When a pull request is **not** a draft-by-title work-in-progress (title does not start with the WIP prefix, default `[WIP] `) and the author is in that list:

- If any changed file path includes a dot-prefixed segment (for example `.github/…`, `.env`), the app posts a single comment explaining that it will not mark the PR ready or approve workflow runs.
- Otherwise, the app clears **draft** if needed and approves **waiting** Actions workflow runs for that PR head SHA.

Optional env: `WIP_TITLE_PREFIX` overrides the default WIP prefix string.

## Usage

With your server running, GitHub delivers [pull_request](https://docs.github.com/webhooks-and-events/webhooks/webhook-events-and-payloads#pull_request) payloads to your server.

- On **open**, the server runs the Copilot gate (if configured).
- On **edited** (for example title change) and **synchronize** (new commits), the Copilot gate runs again.
