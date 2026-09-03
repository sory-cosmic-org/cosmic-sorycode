import { createResource, createSignal, Show, For } from "solid-js"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { useLanguage } from "@/context/language"
import { useServerSDK } from "@/context/server-sdk"
import {
  listCodespacesForRepository,
  startCodespace,
  stopCodespace,
  deleteCodespace,
  type Codespace,
  type RemoteGitRepository,
} from "@/utils/remote-git"

const runtimeLabel: Record<string, string> = {
  running: "Running",
  starting: "Starting",
  stopped: "Stopped",
  provisioning: "Provisioning",
  failed: "Failed",
  unknown: "Unknown",
}

function runtimeColor(runtime: string): string {
  switch (runtime) {
    case "running":
      return "text-emerald-500"
    case "starting":
    case "provisioning":
      return "text-amber-500"
    case "stopped":
      return "text-v2-text-text-faint"
    default:
      return "text-red-500"
  }
}

export function CodespaceManagementPanel(props: {
  repository: RemoteGitRepository
  onReady?: (directory: string) => void
}) {
  const language = useLanguage()
  const server = useServerSDK()
  const [codespaces, { refetch, mutate }] = createResource(
    () => props.repository,
    (repo) => listCodespacesForRepository(server(), repo),
  )
  const [busy, setBusy] = createSignal<string | null>(null)

  const handleStart = async (name: string) => {
    setBusy(name)
    try {
      await startCodespace(server(), name)
      await refetch()
    } finally {
      setBusy(null)
    }
  }

  const handleStop = async (name: string) => {
    setBusy(name)
    try {
      await stopCodespace(server(), name)
      await refetch()
    } finally {
      setBusy(null)
    }
  }

  const handleDelete = async (name: string) => {
    setBusy(name)
    try {
      await deleteCodespace(server(), name)
      await refetch()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div class="flex flex-col gap-2 rounded-md border border-v2-border-border-muted px-3 py-2">
      <div class="flex items-center justify-between">
        <span class="text-[13px] font-medium text-v2-text-text-muted">
          {language.t("codespace.panel.title")}
        </span>
        <button
          type="button"
          class="text-[12px] text-v2-text-text-faint hover:text-v2-text-text-muted"
          onClick={() => refetch()}
        >
          <IconV2 name="arrow-clockwise" size="small" />
        </button>
      </div>
      <Show
        when={codespaces()}
        fallback={
          <span class="text-[12px] text-v2-text-text-faint">
            {codespaces.loading ? language.t("codespace.panel.loading") : language.t("codespace.panel.empty")}
          </span>
        }
      >
        {(items) => (
          <Show
            when={items().length > 0}
            fallback={
              <span class="text-[12px] text-v2-text-text-faint">{language.t("codespace.panel.noCodespaces")}</span>
            }
          >
            <div class="flex flex-col gap-1">
              <For each={items()}>
                {(cs) => (
                  <div class="flex items-center gap-2 text-[12px]">
                    <span class={`shrink-0 ${runtimeColor(cs.runtime)}`}>
                      <IconV2 name={cs.runtime === "running" ? "circle-filled" : "circle"} size="small" />
                    </span>
                    <span class="min-w-0 truncate text-v2-text-text-muted">
                      {cs.displayName ?? cs.name}
                    </span>
                    <span class="shrink-0 text-v2-text-text-faint">
                      {runtimeLabel[cs.runtime] ?? cs.runtime}
                    </span>
                    <span class="shrink-0 text-v2-text-text-faint">
                      {cs.branch}
                    </span>
                    <div class="ml-auto flex shrink-0 gap-1">
                      <Show when={cs.runtime === "stopped"}>
                        <button
                          type="button"
                          disabled={busy() === cs.name}
                          class="text-[12px] text-emerald-500 hover:text-emerald-400 disabled:opacity-50"
                          onClick={() => handleStart(cs.name)}
                        >
                          {busy() === cs.name ? "..." : language.t("codespace.action.start")}
                        </button>
                      </Show>
                      <Show when={cs.runtime === "running"}>
                        <button
                          type="button"
                          disabled={busy() === cs.name}
                          class="text-[12px] text-v2-text-text-faint hover:text-v2-text-text-muted disabled:opacity-50"
                          onClick={() => handleStop(cs.name)}
                        >
                          {busy() === cs.name ? "..." : language.t("codespace.action.stop")}
                        </button>
                      </Show>
                      <button
                        type="button"
                        disabled={busy() === cs.name}
                        class="text-[12px] text-red-500 hover:text-red-400 disabled:opacity-50"
                        onClick={() => handleDelete(cs.name)}
                      >
                        {busy() === cs.name ? "..." : language.t("codespace.action.delete")}
                      </button>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        )}
      </Show>
    </div>
  )
}
