import { ExternalLink } from "lucide-react"
import { requirements } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { useSystem } from "./store"

export function NodeNotice() {
  const r = useSystem((s) => s.readiness)
  if (!r) return null
  if (r.node.ok && r.npmPrefixWritable !== false) return null

  const missing = !r.node.version
  const title = !r.node.ok
    ? missing
      ? "Node.js is needed to install WireCat tools"
      : `Node.js ${r.node.version} is too old for WireCat tools`
    : "npm needs administrator rights to install tools"
  const body = !r.node.ok
    ? `Install ${requirements.nodeLabel}, then check again. WireCat Desktop itself runs without it.`
    : `npm installs into ${r.npmPrefix}. Point it at a folder in your home: npm config set prefix ~/.npm-global, then add ~/.npm-global/bin to your PATH.`

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-4 rounded-[0.2rem] border border-warn/40 bg-warn/10 px-5 py-4"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-[0.95rem] text-ink-soft">{body}</p>
      </div>
      {!r.node.ok && (
        <Button
          variant="primary"
          onClick={() => platform.openUrl(requirements.nodeDownload)}
          icon={<ExternalLink className="size-4" aria-hidden />}
        >
          Get Node.js
        </Button>
      )}
    </div>
  )
}
