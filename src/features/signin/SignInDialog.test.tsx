import { act, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import { useLanguage } from "@/i18n"
import { platform } from "@/platform/bridge"
import { MOCK_CODES } from "@/platform/mock-qr"
import type { SignInEvent } from "@/platform/signin-schemas"
import { useOnboarding } from "../onboarding/store"
import { recentErrors } from "../report/errors"
import { useReport } from "../report/store"
import { NewProfile } from "../tools/Health"
import { SignInDialog } from "./SignInDialog"
import { useSignIn } from "./store"

const SCAN = "scan in WhatsApp → Settings → Linked devices → Link a device"

let send: (e: SignInEvent) => void = () => undefined
let finish: () => void = () => undefined

beforeEach(() => {
  useOnboarding.setState({ open: false })
  useSignIn.setState(useSignIn.getInitialState(), true)
  vi.spyOn(platform, "signIn").mockImplementation((_id, _method, _profile, onEvent) => {
    send = (e) => act(() => onEvent(e))
    return new Promise((resolve) => {
      finish = resolve
    })
  })
  vi.spyOn(platform, "signInStop").mockResolvedValue()
  vi.spyOn(platform, "signInAnswer").mockResolvedValue()
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

    expect(platform.signIn).toHaveBeenCalledWith("wa", "qr", "personal", expect.any(Function))
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

    send({ event: "progress", step: "history", message: null })
    expect(within(dialog).queryByRole("img", { name: /QR code/ })).toBeNull()
    expect(within(dialog).getByText(/Receiving your chat history/)).toBeInTheDocument()

    send({ event: "done", alreadyLinked: false, received: { chats: 4, messages: 1400, people: 2 } })
    expect(within(dialog).getByText(/^WhatsApp is signed in as /)).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Open WhatsApp" })).toBeInTheDocument()
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

describe("answering what the tool asks", () => {
  async function open(tool: string, profile = "personal") {
    render(<SignInDialog />)
    act(() => useSignIn.getState().start(tool, profile))
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalled())
    return screen.getByRole("dialog")
  }

  it("asks Telegram's questions one at a time, masks the password and keeps no answer", async () => {
    const dialog = await open("tg")
    expect(platform.signIn).toHaveBeenCalledWith("tg", "qr", "personal", expect.any(Function))
    send({ event: "openUrl", url: "https://my.telegram.org/apps", purpose: "copy App api_id and App api_hash" })
    expect(within(dialog).getByRole("button", { name: "Open my.telegram.org" })).toBeInTheDocument()

    send({ event: "needs", field: "password", secret: true, prompt: "2FA password (not shown)", hint: "the cat" })
    const field = within(dialog).getByLabelText("2FA password")
    expect(field).toHaveAttribute("type", "password")
    expect(field).toHaveFocus()
    expect(within(dialog).getByText("Hint: the cat")).toBeInTheDocument()

    await userEvent.type(field, "not-a-real-password{Enter}")
    expect(platform.signInAnswer).toHaveBeenCalledWith("tg", "not-a-real-password")
    expect(field).toHaveValue("")
    expect(within(dialog).getByText(/Sent\. Waiting/)).toBeInTheDocument()
    expect(JSON.stringify(useSignIn.getState())).not.toContain("not-a-real-password")

    send({ event: "done", alreadyLinked: false, received: null })
    expect(within(dialog).getByText(/is signed in as personal\./)).toBeInTheDocument()
  })

  it("offers Telegram's other way in, and starts it after the running one stops", async () => {
    const dialog = await open("tg", "work")
    send({ event: "qr", text: MOCK_CODES[0] ?? "", expiresAt: null, scan: "scan in Telegram" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Use phone number instead" }))
    expect(platform.signInStop).toHaveBeenCalledWith("tg")
    finish()
    await vi.waitFor(() =>
      expect(platform.signIn).toHaveBeenLastCalledWith("tg", "phone", "work", expect.any(Function)),
    )
  })

  it("keeps Zoom's page beside the pasted-address fallback, and drops the question when the browser answers", async () => {
    const dialog = await open("zm")
    send({
      event: "openUrl",
      url: "https://zoom.us/oauth/authorize?x=1",
      purpose: "Approve access to Zoom in the browser",
    })
    expect(within(dialog).getByText(/Waiting for you to finish in the browser/)).toBeInTheDocument()
    send({ event: "needs", field: "redirect", secret: true, prompt: "the address it ended on", hint: null })
    expect(within(dialog).getByRole("button", { name: "Open zoom.us" })).toBeInTheDocument()
    expect(within(dialog).getByLabelText("The address it ended on")).toBeInTheDocument()

    send({ event: "done", alreadyLinked: false, received: null })
    expect(within(dialog).queryByLabelText("The address it ended on")).toBeNull()
  })

  it("asks for Zoom's Public Client ID when the tool has none, saves it with zm's own config set and starts again", async () => {
    vi.spyOn(platform, "settingsSet").mockResolvedValue()
    const dialog = await open("zm")
    send({ event: "failed", code: "configuration_error", message: "run zm config set zoom.client_id <id> first" })
    await userEvent.type(within(dialog).getByLabelText("Public Client ID"), "abcDEF123{Enter}")
    expect(platform.settingsSet).toHaveBeenCalledWith("zm", null, false, "zoom.client_id", "abcDEF123")
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalledTimes(2))
  })

  it("says an older tool must be updated, and offers no field", async () => {
    const dialog = await open("max")
    send({ event: "failed", code: "needs_update", message: "This version cannot sign in here yet." })
    expect(within(dialog).getByRole("alert")).toHaveTextContent("cannot sign in here yet")
    expect(within(dialog).queryByRole("textbox")).toBeNull()
    const openSetup = vi.spyOn(platform, "openSetup").mockResolvedValue()
    await userEvent.click(within(dialog).getByRole("button", { name: "Open terminal" }))
    expect(openSetup).toHaveBeenCalledWith("max", "personal")
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})

describe("in Russian", () => {
  it("names the dialog and counts what came from the phone in Russian forms", async () => {
    useLanguage.setState({ choice: "ru" })
    render(<SignInDialog />)
    act(() => useSignIn.getState().start("wa", "personal"))
    const dialog = await screen.findByRole("dialog", { name: "Вход в WhatsApp" })
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalled())

    send({ event: "done", alreadyLinked: false, received: { chats: 4, messages: 21, people: 5 } })
    expect(within(dialog).getByText("Получено с телефона: 4 чата, 21 сообщение и 5 человек.")).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Готово" })).toBeInTheDocument()
  })

  it("translates a failure the tool reports with a code", async () => {
    useLanguage.setState({ choice: "ru" })
    render(<SignInDialog />)
    act(() => useSignIn.getState().start("max", "personal"))
    const dialog = await screen.findByRole("dialog")
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalled())
    send({ event: "failed", code: "needs_update", message: "This version cannot sign in here yet." })
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Эта версия пока не умеет входить здесь.")
  })
})
