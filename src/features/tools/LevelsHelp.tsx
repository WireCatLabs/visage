import { useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import type { Level } from "@/platform/permissions-schemas"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { LEVEL_LABEL, LEVELS } from "./permissions"

// Wording follows cli-base's permissions standard (WC-PERM-2, -4, -6, -11), WC-MCP-7, tg-cli's docs/permissions.md,
// and the keys cli-core's `keyForCommand` checks each command against.
const LEVEL_HELP: Record<Level, string> = {
  allow: "The agent reads and changes without asking. A few changes that cannot be undone still ask first.",
  ask: "Reading works. Each change asks for a yes in the terminal first. Over MCP nobody is at a terminal, so the change goes ahead unless the agent's app asks you itself.",
  readonly: "Reading works. Every change is refused.",
  deny: "Nothing works, not even reading. The agent still sees the commands, marked as not allowed.",
}

const GROUP_HELP: Record<string, { reads: string; changes: string }> = {
  messages: {
    reads:
      "Reading and searching messages. Every command that shows what people wrote counts as Messages too: the inbox, search, watching for new messages, and listing or downloading files.",
    changes: "Sending, editing, forwarding, pinning and deleting messages. Deleting asks first, even at Allow.",
  },
  reactions: { reads: "Seeing reactions.", changes: "Adding and removing reactions." },
  polls: { reads: "Seeing polls and their results.", changes: "Creating polls, voting and closing them." },
  topics: {
    reads: "Listing the topics of a group.",
    changes:
      "Creating and editing topics, turning topics on in a group, and deleting them. Turning on and deleting ask first, even at Allow.",
  },
  chats: {
    reads: "Listing chats and groups, their details and their members.",
    changes:
      "Changes to chats and groups, such as their settings, members and admins, invite links, muting, archiving, pinning, marking as read, leaving, deleting a chat and clearing its history. Deleting and clearing ask first, even at Allow.",
  },
  contacts: {
    reads: "Listing and showing contacts.",
    changes: "Adding, removing, importing, renaming and blocking contacts, and your own notes and aliases for them.",
  },
  account: {
    reads: "Seeing your own profile.",
    changes:
      "Your profile and privacy settings, and ending your other sessions where the app has it. Ending sessions asks first, and an agent over MCP can never do it.",
  },
  attachments: {
    reads:
      "Listing and downloading files is checked as Messages, and downloading as Chats too, so Block on Messages stops it. Showing a file's text needs both Files and Messages.",
    changes: "Extracting text from saved files, moving them and updating them. This stays on this computer.",
  },
  tasks: {
    reads: "Listing and showing tasks.",
    changes: "Adding, claiming, closing, updating, merging and linking tasks. This stays on this computer.",
  },
}

export function LevelsHelp({ tool }: { tool: CatalogTool }) {
  const [open, setOpen] = useState(false)
  const groups = (tool.permissions?.groups ?? []).filter((g) => g.key in GROUP_HELP)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded text-[0.875rem] font-medium text-brand hover:text-brand-hover hover:underline hover:underline-offset-4"
      >
        What do these levels mean?
      </button>
      <Dialog
        open={open}
        wide
        scroll
        title="What the levels mean"
        onClose={() => setOpen(false)}
        actions={
          <Button onClick={() => setOpen(false)} data-autofocus>
            Close
          </Button>
        }
      >
        <p>
          Each group has one level. It applies to your agent and your scripts alike, through {tool.bin} on the command
          line or over MCP.
        </p>
        <dl className="mt-3 flex flex-col gap-2.5">
          {LEVELS.map((l) => (
            <div key={l}>
              <dt className="font-medium text-ink">
                {LEVEL_LABEL[l]} <code className="ml-1 font-mono text-[0.85rem] text-ink-dim">{l}</code>
              </dt>
              <dd>{LEVEL_HELP[l]}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3">
          The level marked "(default)" is what a group gets when nothing is set: the defaults' level in a profile, and
          Allow in the defaults. Choosing it removes the setting. To stop an agent from changing something, choose Read
          only or Block.
        </p>
        {groups.length > 0 && (
          <>
            <h3 className="mt-5 mb-1 text-[1rem] font-semibold text-ink">What each group covers</h3>
            <p className="mb-2">Not every app has every action listed here.</p>
            <dl className="mb-2 flex flex-col gap-3">
              {groups.map((g) => {
                const help = GROUP_HELP[g.key]
                return (
                  help && (
                    <div key={g.key}>
                      <dt className="font-medium text-ink">
                        {g.label} <code className="ml-1 font-mono text-[0.85rem] text-ink-dim">{g.key}</code>
                      </dt>
                      <dd>
                        <span className="text-ink">Reading:</span> {help.reads}
                      </dd>
                      <dd>
                        <span className="text-ink">Changing:</span> {help.changes}
                      </dd>
                    </div>
                  )
                )
              })}
            </dl>
          </>
        )}
      </Dialog>
    </>
  )
}
