/**
 * What to click in each browser app, read from the vendors' own pages on 2026-10-27 (journal FIND-57). Check them
 * again when a vendor changes its menus:
 * - ChatGPT: https://help.openai.com/en/articles/12584461-creating-custom-mcp-apps-in-chatgpt,
 *   https://developers.openai.com/api/docs/guides/custom-mcp-server,
 *   https://developers.openai.com/plugins/deploy/connect-chatgpt
 * - Claude: https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp,
 *   https://claude.com/docs/connectors/custom/add-unlisted
 *
 * The address and the login code come from the running server (`connectorUrl`, `loginCode`), never from here, so a
 * different address shape changes nothing below.
 */

export type AppId = "chatgpt" | "claude" | "other"

export type AppStep = {
  /** One instruction; quoted words are the labels the app shows. */
  text: string
  /** A field to copy under the instruction. */
  copy?: "url" | "code" | "name"
  link?: { label: string; href: string }
}

export type AiApp = {
  id: AppId
  name: string
  /** What the choice button says under the name. */
  hint: string
  steps: AppStep[]
  /** Plans and places where it works, from the vendor's page. */
  limits: string
  help: { label: string; href: string } | null
}

const CONSENT: AppStep = {
  text: "A WireCat login page opens. Check it names the app you are connecting, type the login code and press “Allow”.",
  copy: "code",
}

export const APPS: Record<AppId, AiApp> = {
  chatgpt: {
    id: "chatgpt",
    name: "ChatGPT",
    hint: "chatgpt.com, as a plugin",
    steps: [
      {
        text: "Open ChatGPT in the browser and go to “Plugins”.",
        link: { label: "Open Plugins", href: "https://chatgpt.com/plugins" },
      },
      { text: "Press the “+” button, then “Add custom MCP server”." },
      { text: "Give it a name.", copy: "name" },
      { text: "Under “Connection”, paste this address.", copy: "url" },
      { text: "For authentication, choose “OAuth”." },
      { text: "Tick “I understand and want to continue”, then press “Create as a plugin”." },
      CONSENT,
      { text: "Install the plugin, start a new chat, type @ and pick it." },
    ],
    limits:
      "On ChatGPT in the browser for Business, Enterprise and Edu; on Pro it can only read. Workspace admins may have to allow it.",
    help: {
      label: "OpenAI's help page",
      href: "https://help.openai.com/en/articles/12584461-creating-custom-mcp-apps-in-chatgpt",
    },
  },
  claude: {
    id: "claude",
    name: "Claude",
    hint: "claude.ai, as a connector",
    steps: [
      {
        text: "Open claude.ai and go to “Customize”, then “Connectors”.",
        link: { label: "Open Connectors", href: "https://claude.ai/customize/connectors" },
      },
      { text: "Press “+ Add”, then “Add custom connector”." },
      { text: "Give it a name.", copy: "name" },
      { text: "Paste this address as the MCP server URL, then press “Continue”.", copy: "url" },
      { text: "Under “OAuth client”, choose “Register automatically”, then press “Add”." },
      CONSENT,
      { text: "In a chat, press “+”, then “Connectors”, and turn it on." },
    ],
    limits:
      "On every plan; the free plan allows one custom connector. On Team and Enterprise an owner adds it under Organization settings, then each member presses “Connect”.",
    help: {
      label: "Anthropic's help page",
      href: "https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp",
    },
  },
  other: {
    id: "other",
    name: "Another app",
    hint: "any app that takes a remote MCP server",
    steps: [
      {
        text: "In the app's settings, add a remote MCP server (some apps say connector) with this address.",
        copy: "url",
      },
      { text: "If it asks how to log in, choose OAuth, and let it register itself." },
      CONSENT,
    ],
    limits: "The app must reach the internet address above from its own servers and log in with OAuth.",
    help: null,
  },
}

/** A first request that touches the tool, so the guide can see a call arrive. */
const PROMPTS: Record<string, string> = {
  tg: "List my last 3 Telegram chats.",
  max: "List my last 3 MAX chats.",
  wa: "List my last 3 WhatsApp chats.",
  drive: "List the 3 Google Drive files I changed last.",
  memo: "List my 3 most recent notes.",
}

export const testPrompt = (tool: { id: string; name: string }) =>
  PROMPTS[tool.id] ?? `What can you do with ${tool.name}?`

export const connectorName = (tool: { name: string }) => `${tool.name} (WireCat)`
