import { useDialog } from "@opencode-ai/ui/context/dialog"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { createSignal } from "solid-js"
import { DialogVcsBranch } from "@/components/dialog-vcs-branch"
import { DialogVcsCommit } from "@/components/dialog-vcs-commit"
import { useLanguage } from "@/context/language"
import { useSDK } from "@/context/sdk"
import { useServerSDK } from "@/context/server-sdk"
import { showToast } from "@/utils/toast"

function vcsErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object") {
    const data = "data" in error ? error.data : undefined
    if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
      return data.message
    }
    if ("message" in error && typeof error.message === "string") return error.message
  }
  return fallback
}

export function SessionGitActions(props: { hasChanges: () => boolean; onRefresh: () => void }) {
  const language = useLanguage()
  const dialog = useDialog()
  const sdk = useSDK()
  const serverSDK = useServerSDK()
  const [busy, setBusy] = createSignal<"commit" | "push" | "fetch" | "branch">()

  const commit = async (message: string) => {
    if (busy()) throw new Error(language.t("session.review.git.busy"))
    setBusy("commit")
    try {
      const result = await serverSDK()
        .createClient({ directory: sdk().directory })
        .vcs.commit({ message })
      if (result.error) throw new Error(vcsErrorMessage(result.error, language.t("common.requestFailed")))
      if (!result.data) throw new Error(language.t("common.requestFailed"))
      showToast({
        variant: "success",
        title: language.t("session.review.git.commitSuccess"),
        description: result.data.hash.slice(0, 7),
      })
      props.onRefresh()
    } finally {
      setBusy(undefined)
    }
  }

  const push = async () => {
    if (busy()) return
    setBusy("push")
    try {
      const result = await serverSDK().createClient({ directory: sdk().directory }).vcs.push()
      if (result.error) throw new Error(vcsErrorMessage(result.error, language.t("common.requestFailed")))
      if (!result.data) throw new Error(language.t("common.requestFailed"))
      showToast({
        variant: "success",
        title: language.t("session.review.git.pushSuccess"),
        description: result.data.remote,
      })
      props.onRefresh()
    } catch (error) {
      showToast({
        variant: "error",
        title: language.t("common.requestFailed"),
        description: vcsErrorMessage(error, language.t("common.requestFailed")),
      })
    } finally {
      setBusy(undefined)
    }
  }

  const openCommit = () => {
    if (busy() || !props.hasChanges()) return
    void dialog.show(() => <DialogVcsCommit onCommit={commit} />)
  }

  const fetch = async () => {
    if (busy()) return
    setBusy("fetch")
    try {
      const result = await serverSDK().createClient({ directory: sdk().directory }).vcs.fetch()
      if (result.error) throw new Error(vcsErrorMessage(result.error, language.t("common.requestFailed")))
      if (!result.data) throw new Error(language.t("common.requestFailed"))
      showToast({
        variant: "success",
        title: language.t("session.review.git.fetchSuccess"),
        description: result.data.remote,
      })
      props.onRefresh()
    } catch (error) {
      showToast({
        variant: "error",
        title: language.t("common.requestFailed"),
        description: vcsErrorMessage(error, language.t("common.requestFailed")),
      })
    } finally {
      setBusy(undefined)
    }
  }

  const switchBranch = async (name: string, create: boolean) => {
    if (busy()) throw new Error(language.t("session.review.git.busy"))
    setBusy("branch")
    try {
      const result = await serverSDK().createClient({ directory: sdk().directory }).vcs.branch({ name, create })
      if (result.error) throw new Error(vcsErrorMessage(result.error, language.t("common.requestFailed")))
      if (!result.data) throw new Error(language.t("common.requestFailed"))
      showToast({
        variant: "success",
        title: language.t("session.review.git.branchSuccess"),
        description: result.data.branch,
      })
      props.onRefresh()
    } finally {
      setBusy(undefined)
    }
  }

  const openBranch = () => {
    if (busy()) return
    void dialog.show(() => <DialogVcsBranch onSwitch={switchBranch} />)
  }

  return (
    <div class="flex items-center gap-1">
      <ButtonV2
        size="small"
        variant="ghost"
        icon="review"
        disabled={!props.hasChanges() || !!busy()}
        title={language.t("session.review.git.commit")}
        aria-label={language.t("session.review.git.commit")}
        onClick={openCommit}
      >
        {busy() === "commit" ? language.t("session.review.git.commitLoading") : language.t("session.review.git.commit")}
      </ButtonV2>
      <ButtonV2
        size="small"
        variant="ghost"
        icon="outline-square-arrow"
        disabled={!!busy()}
        title={language.t("session.review.git.push")}
        aria-label={language.t("session.review.git.push")}
        onClick={() => void push()}
      >
        {busy() === "push" ? language.t("session.review.git.pushLoading") : language.t("session.review.git.push")}
      </ButtonV2>
      <ButtonV2
        size="small"
        variant="ghost"
        icon="status"
        disabled={!!busy()}
        title={language.t("session.review.git.fetch")}
        aria-label={language.t("session.review.git.fetch")}
        onClick={() => void fetch()}
      >
        {busy() === "fetch" ? language.t("session.review.git.fetchLoading") : language.t("session.review.git.fetch")}
      </ButtonV2>
      <ButtonV2
        size="small"
        variant="ghost"
        icon="branch"
        disabled={!!busy()}
        title={language.t("session.review.git.branch")}
        aria-label={language.t("session.review.git.branch")}
        onClick={openBranch}
      >
        {busy() === "branch" ? language.t("session.review.git.branchLoading") : language.t("session.review.git.branch")}
      </ButtonV2>
    </div>
  )
}