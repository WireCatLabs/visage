import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useLanguage } from "@/i18n"
import { platform } from "@/platform/bridge"
import { NodeNotice } from "./NodeNotice"
import { useNode } from "./node-store"
import { ReadinessStrip } from "./ReadinessStrip"
import { useSystem } from "./store"

const absent = { path: null, version: null, ok: false, problem: "not found" }

beforeEach(() => {
  useNode.setState(useNode.getInitialState(), true)
  vi.spyOn(platform, "nodeOffer").mockResolvedValue({ version: "24.19.0", bytes: null, dir: "~/.local/share/wirecat" })
  useSystem.setState({
    readiness: {
      os: "Linux",
      arch: "x86_64",
      node: absent,
      npm: absent,
      pnpm: absent,
      npmPrefix: null,
      npmPrefixWritable: null,
      managed: null,
    },
  })
})

afterEach(() => vi.restoreAllMocks())

describe("a computer without Node.js, in Russian", () => {
  it("asks for Node.js and says what is missing in the readiness strip", async () => {
    useLanguage.setState({ choice: "ru" })
    render(
      <>
        <ReadinessStrip />
        <NodeNotice />
      </>,
    )
    expect(screen.getByText("Для установки инструментов WireCat нужен Node.js")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Установить Node.js за меня" })).toBeInTheDocument()
    expect(
      await screen.findByText(/с nodejs\.org, сверяется с опубликованными контрольными суммами/),
    ).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Ваш компьютер" })).toHaveTextContent("Node.js не найден")
  })
})
