import { act, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import { MOCK_CODES } from "@/platform/mock-qr"
import type { SignInEvent } from "@/platform/signin-schemas"
import { recentErrors } from "../report/errors"
import { useReport } from "../report/store"
import { NewProfile } from "../tools/Health"
import { SignInDialog } from "./SignInDialog"
import { useSignIn } from "./store"

const SCAN = "scan in WhatsApp → Settings → Linked devices → Link a device"

let send: (e: SignInEvent) => void = () => undefined
let finish: () => void = () => undefined

beforeEach(() => {
  useSignIn.setState(useSignIn.getInitialState(), true)
  vi.spyOn(platform, "signIn").mockImplementation((_id, _profile, onEvent) => {
    send = (e) => act(() => onEvent(e))
    return new Promise((resolve) => {
      finish = resolve
    })
  })
  vi.spyOn(platform, "signInStop").mockResolvedValue()
})

afterEach(() => {
  vi.restoreAllMocks()
  useReport.getState().close()
})

const wa = findTool("wa")
if (!wa) throw new Error("wa is in the catalog")

function signInForm(onCheck = vi.fn()) {
  render(
    <>
      <NewProfile tool={wa as NonNullable<typeof wa>} onCheck={onCheck} checking={false} />
      <SignInDialog />
    </>,
  )
  return onCheck
}

async function startAs(name: string) {
  await userEvent.type(screen.getByLabelText(/Name for this account/), `${name}{Enter}`)
  return screen.getByRole("dialog", { name: "Sign in to WhatsApp" })
}

describe("signing in to WhatsApp inside the window", () => {
  it("draws each code the tool sends, then its history, and refreshes the accounts when done", async () => {
    const onCheck = signInForm()
    expect(screen.getByRole("button", { name: "Open terminal" })).toBeInTheDocument()
    const dialog = await startAs("personal")

    expect(platform.signIn).toHaveBeenCalledWith("wa", "personal", expect.any(Function))
    send({ event: "note", text: "Before you link: wa is not an official WhatsApp app." })
    send({ event: "qr", text: MOCK_CODES[0] ?? "", expiresAt: null, scan: SCAN })
    const code = within(dialog).getByRole("img", { name: /QR code/ })
    expect(code.tagName.toLowerCase()).toBe("svg")
    const first = code.querySelector("path")?.getAttribute("d")
    expect(within(dialog).getByText(/not an official WhatsApp app/)).toBeInTheDocument()
    expect(within(dialog).getByText(/^Scan in WhatsApp → Settings/)).toBeInTheDocument()

    send({ event: "qr", text: MOCK_CODES[1] ?? "", expiresAt: null, scan: SCAN })
    expect(
      within(dialog)
        .getByRole("img", { name: /QR code/ })
        .querySelector("path")
        ?.getAttribute("d"),
    ).not.toBe(first)

    send({ event: "progress", step: "history" })
    expect(within(dialog).queryByRole("img", { name: /QR code/ })).toBeNull()
    expect(within(dialog).getByText(/Receiving your chat history/)).toBeInTheDocument()

    send({ event: "done", alreadyLinked: false, received: { chats: 4, messages: 1400, people: 2 } })
    expect(within(dialog).getByText("Signed in.")).toBeInTheDocument()
    expect(within(dialog).getByText(/Received 4 chats, 1,400 messages and 2 people/)).toBeInTheDocument()
    expect(onCheck).toHaveBeenCalledOnce()
    const done = within(dialog).getByRole("button", { name: "Done" })
    expect(done).toHaveFocus()

    await userEvent.keyboard("{Enter}")
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("asks the tool to stop on Escape and closes once it has stopped", async () => {
    signInForm()
    const dialog = await startAs("work")
    send({ event: "qr", text: MOCK_CODES[0] ?? "", expiresAt: null, scan: SCAN })

    // jsdom does not turn Escape into the dialog's cancel event, which the browser does.
    fireEvent(dialog, new Event("cancel", { cancelable: true }))
    expect(platform.signInStop).toHaveBeenCalledWith("wa")
    expect(within(dialog).getByRole("button", { name: "Stopping…" })).toBeDisabled()

    send({ event: "stopped" })
    finish()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("shows the tool's refusal with Report this, and the report carries no code", async () => {
    signInForm()
    const dialog = await startAs("personal")
    send({ event: "qr", text: MOCK_CODES[0] ?? "", expiresAt: null, scan: SCAN })
    send({
      event: "failed",
      message: "this WhatsApp login is in use by wa personal serve",
      code: "provider_unavailable",
    })

    expect(within(dialog).getByRole("alert")).toHaveTextContent("in use by wa personal serve")
    expect(within(dialog).getByRole("button", { name: "Try again" })).toHaveFocus()
    await userEvent.click(within(dialog).getByRole("button", { name: /Report this/ }))

    expect(screen.queryByRole("dialog", { name: "Sign in to WhatsApp" })).toBeNull()
    const report = JSON.stringify([useReport.getState().prefill, recentErrors()])
    expect(report).toContain("in use by wa personal serve")
    expect(report).not.toContain("█")
  })

  it("never starts without a valid name the owner typed", async () => {
    signInForm()
    expect(screen.getByRole("button", { name: "Sign in here" })).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/Name for this account/), "-bad{Enter}")
    expect(platform.signIn).not.toHaveBeenCalled()
  })
})
