import type { connectMessages } from "./messages-connect"

/**
 * What to click in each browser app, read from the vendors' own pages on 2026-10-27 (journal FIND-57). Check them
 * again when a vendor changes its menus:
 * - ChatGPT: https://help.openai.com/en/articles/12584461-creating-custom-mcp-apps-in-chatgpt,
 *   https://developers.openai.com/api/docs/guides/custom-mcp-server,
 *   https://developers.openai.com/plugins/deploy/connect-chatgpt
 * - Claude: https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp,
 *   https://claude.com/docs/connectors/custom/add-unlisted
 *
 * Their words are in `messages-connect.tsx`. The address and the login code come from the running server
 * (`connectorUrl`, `loginCode`), never from here, so a different address shape changes nothing below.
 */

export type AppId = "chatgpt" | "claude" | "other"

type Words = (typeof connectMessages)["en"]

export type AppStep = {
  /** One instruction; quoted words are the labels the app shows. */
  text: keyof Words["appSteps"]
  /** A field to copy under the instruction. */
  copy?: "url" | "code" | "name"
  link?: { label: keyof Words["appLinks"]; href: string }
}

export type AiApp = {
  id: AppId
  steps: AppStep[]
  /** The vendor's help page; its label and the plans it works on are in the catalog. */
  help: string | null
}

const CONSENT: AppStep = { text: "consent", copy: "code" }

/** An old connector to the same computer (another address, another tunnel) keeps failing and gets picked first. */
const OLD: AppStep = { text: "old" }

export const APPS: Record<AppId, AiApp> = {
  chatgpt: {
    id: "chatgpt",
    steps: [
      { text: "chatgptOpen", link: { label: "plugins", href: "https://chatgpt.com/plugins" } },
      OLD,
      { text: "chatgptAdd" },
      { text: "name", copy: "name" },
      { text: "chatgptUrl", copy: "url" },
      { text: "chatgptAuth" },
      { text: "chatgptCreate" },
      CONSENT,
      { text: "chatgptUse" },
    ],
    help: "https://help.openai.com/en/articles/12584461-creating-custom-mcp-apps-in-chatgpt",
  },
  claude: {
    id: "claude",
    steps: [
      { text: "claudeOpen", link: { label: "connectors", href: "https://claude.ai/customize/connectors" } },
      OLD,
      { text: "claudeAdd" },
      { text: "name", copy: "name" },
      { text: "claudeUrl", copy: "url" },
      { text: "claudeAuth" },
      CONSENT,
      { text: "claudeUse" },
    ],
    help: "https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp",
  },
  other: {
    id: "other",
    steps: [{ text: "otherUrl", copy: "url" }, { text: "otherAuth" }, CONSENT],
    help: null,
  },
}

/** A first request that touches the tool, so the guide can see a call arrive. */
export const testPrompt = (tool: { id: string; name: string }, m: Words) =>
  m.prompts[tool.id] ?? m.promptOther(tool.name)

export const connectorName = (tool: { name: string }) => `${tool.name} (WireCat)`
