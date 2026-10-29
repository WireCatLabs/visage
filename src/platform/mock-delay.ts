// `?slow=<factor>` stretches every mock wait, so each loading stage stays on screen long enough to capture.
const slow = Number(new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("slow")) || 1

export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms * slow))
