import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@opencode-ai/ui/v2/dialog-v2"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { DividerV2 } from "@opencode-ai/ui/v2/divider-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { createEffect, createResource, createSignal, For, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { useServerSDK } from "@/context/server-sdk"
import {
  listRemoteBranches,
  listRemoteRepositories,
  type RemoteGitBranch,
  type RemoteGitRepository,
} from "@/utils/remote-git"

export type RemoteGitSelection = {
  repository: RemoteGitRepository
  branch: RemoteGitBranch
}

export function PromptRemoteRepositoryButton(props: {
  selection?: RemoteGitSelection
  onClick: () => void
}) {
  return (
    <button
      type="button"
      class="flex h-7 min-w-0 max-w-[240px] items-center gap-1.5 rounded-sm px-1.5 text-[13px] font-[440] leading-5 tracking-[-0.04px] text-v2-text-text-faint transition-colors hover:bg-v2-overlay-simple-overlay-hover hover:text-v2-text-text-muted focus-visible:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none"
      onClick={props.onClick}
    >
      <IconV2 name="code" class="shrink-0 text-v2-icon-icon-muted" />
      <span class="min-w-0 truncate">{props.selection?.repository.fullName ?? "GitHub repository"}</span>
      <Show when={props.selection}>
        <span class="shrink-0 text-v2-text-text-faint">/ {props.selection?.branch.name}</span>
      </Show>
      <IconV2 name="chevron-down" class="shrink-0 text-v2-icon-icon-muted" />
    </button>
  )
}

export function DialogSelectRemoteRepository(props: { onSelect: (selection: RemoteGitSelection) => void }) {
  const dialog = useDialog()
  const language = useLanguage()
  const server = useServerSDK()
  const [search, setSearch] = createSignal("")
  const [submittedSearch, setSubmittedSearch] = createSignal("")
  const [selectedRepository, setSelectedRepository] = createSignal<RemoteGitRepository>()
  const [selectedBranch, setSelectedBranch] = createSignal("")
  const [repositories] = createResource(submittedSearch, (query) => listRemoteRepositories(server(), query))
  const [branches] = createResource(selectedRepository, (repository) =>
    repository ? listRemoteBranches(server(), repository) : Promise.resolve(undefined),
  )

  createEffect(() => {
    const repository = selectedRepository()
    setSelectedBranch(repository?.defaultBranch ?? "")
  })

  const submitSearch = (event?: Event) => {
    event?.preventDefault()
    setSubmittedSearch(search())
  }

  const select = () => {
    const repository = selectedRepository()
    const branch = branches()?.items.find((item) => item.name === selectedBranch()) ?? {
      name: selectedBranch(),
      protected: false,
    }
    if (!repository || !branch.name) return
    props.onSelect({ repository, branch })
    dialog.close()
  }

  return (
    <Dialog size="large">
      <DialogHeader>
        <DialogTitle>Choose a GitHub repository</DialogTitle>
      </DialogHeader>
      <DividerV2 />
      <DialogBody class="flex min-h-0 flex-col gap-3">
        <form class="flex gap-2" onSubmit={submitSearch}>
          <TextInputV2
            value={search()}
            autofocus
            autocomplete="off"
            placeholder="Search repositories"
            class="!w-full"
            onInput={(event) => setSearch(event.currentTarget.value)}
          />
          <ButtonV2 type="submit" variant="neutral" aria-label="Search">
            <IconV2 name="magnifying-glass" />
          </ButtonV2>
        </form>
        <div class="grid min-h-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <section class="min-h-0 overflow-hidden rounded-md border border-v2-border-border-muted">
            <div class="flex h-8 items-center border-b border-v2-border-border-muted px-3 text-[11px] font-[530] uppercase tracking-[0.05px] text-v2-text-text-faint">
              Repositories
            </div>
            <div class="max-h-[280px] overflow-y-auto p-1">
              <Show when={!repositories.loading} fallback={<div class="p-3 text-sm text-v2-text-text-faint">{language.t("common.loading")}</div>}>
                <Show
                  when={(repositories()?.items.length ?? 0) > 0}
                  fallback={<div class="p-3 text-sm text-v2-text-text-faint">No repositories found</div>}
                >
                  <For each={repositories()?.items}>
                    {(repository) => (
                      <button
                        type="button"
                        class="flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-v2-overlay-simple-overlay-hover focus-visible:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none"
                        classList={{
                          "bg-v2-overlay-simple-overlay-pressed": selectedRepository()?.id === repository.id,
                        }}
                        onClick={() => setSelectedRepository(repository)}
                      >
                        <span class="flex w-full items-center gap-1.5 text-[13px] text-v2-text-text-base">
                          <IconV2 name="code" size="small" class="shrink-0 text-v2-icon-icon-muted" />
                          <span class="min-w-0 flex-1 truncate">{repository.fullName}</span>
                          <Show when={repository.private}>
                            <span class="text-[10px] text-v2-text-text-faint">private</span>
                          </Show>
                        </span>
                        <Show when={repository.description}>
                          <span class="mt-0.5 w-full truncate pl-5 text-[11px] text-v2-text-text-faint">
                            {repository.description}
                          </span>
                        </Show>
                      </button>
                    )}
                  </For>
                </Show>
              </Show>
              <Show when={repositories.error}>
                <div class="p-3 text-sm text-v2-text-text-warning">Unable to load GitHub repositories.</div>
              </Show>
            </div>
          </section>
          <section class="min-h-0 overflow-hidden rounded-md border border-v2-border-border-muted">
            <div class="flex h-8 items-center border-b border-v2-border-border-muted px-3 text-[11px] font-[530] uppercase tracking-[0.05px] text-v2-text-text-faint">
              Branch
            </div>
            <div class="max-h-[280px] overflow-y-auto p-1">
              <Show
                when={selectedRepository()}
                fallback={<div class="p-3 text-sm text-v2-text-text-faint">Select a repository first</div>}
              >
                <Show when={!branches.loading} fallback={<div class="p-3 text-sm text-v2-text-text-faint">{language.t("common.loading")}</div>}>
                  <For each={branches()?.items}>
                    {(branch) => (
                      <button
                        type="button"
                        class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px] text-v2-text-text-base transition-colors hover:bg-v2-overlay-simple-overlay-hover focus-visible:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none"
                        classList={{
                          "bg-v2-overlay-simple-overlay-pressed": selectedBranch() === branch.name,
                        }}
                        onClick={() => setSelectedBranch(branch.name)}
                      >
                        <IconV2 name="branch" size="small" class="shrink-0 text-v2-icon-icon-muted" />
                        <span class="min-w-0 flex-1 truncate">{branch.name}</span>
                        <Show when={branch.protected}>
                          <span class="text-[10px] text-v2-text-text-faint">protected</span>
                        </Show>
                      </button>
                    )}
                  </For>
                </Show>
              </Show>
              <Show when={branches.error}>
                <div class="p-3 text-sm text-v2-text-text-warning">Unable to load branches.</div>
              </Show>
            </div>
          </section>
        </div>
      </DialogBody>
      <DialogFooter>
        <ButtonV2 variant="neutral" onClick={() => dialog.close()}>
          {language.t("common.cancel")}
        </ButtonV2>
        <ButtonV2 variant="contrast" disabled={!selectedRepository() || !selectedBranch()} onClick={select}>
          Select repository
        </ButtonV2>
      </DialogFooter>
    </Dialog>
  )
}