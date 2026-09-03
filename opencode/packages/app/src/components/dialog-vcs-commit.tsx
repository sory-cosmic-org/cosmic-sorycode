import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@opencode-ai/ui/v2/dialog-v2"
import { Field } from "@opencode-ai/ui/v2/field-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { createSignal } from "solid-js"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useLanguage } from "@/context/language"

export function DialogVcsCommit(props: { onCommit: (message: string) => Promise<void> }) {
  const language = useLanguage()
  const dialog = useDialog()
  const [message, setMessage] = createSignal("")
  const [error, setError] = createSignal<string>()
  const [submitting, setSubmitting] = createSignal(false)

  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    const value = message().trim()
    if (!value || submitting()) return

    setSubmitting(true)
    setError(undefined)
    try {
      await props.onCommit(value)
      dialog.close()
    } catch (error) {
      setError(error instanceof Error ? error.message : language.t("common.requestFailed"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog fit>
      <form onSubmit={submit} class="contents">
        <DialogHeader>
          <DialogTitle>{language.t("session.review.git.commitDialog.title")}</DialogTitle>
        </DialogHeader>
        <DialogBody class="flex w-full flex-col gap-4 px-4 pt-4 pb-1">
          <Field>
            <Field.Label>{language.t("session.review.git.commitDialog.message")}</Field.Label>
            <TextInputV2
              autofocus
              appearance="large"
              class="!w-full"
              value={message()}
              placeholder={language.t("session.review.git.commitDialog.placeholder")}
              invalid={!!error()}
              onInput={(event) => {
                setMessage(event.currentTarget.value)
                if (error()) setError(undefined)
              }}
            />
            <div class="text-12-regular text-text-error" role="alert">
              {error()}
            </div>
          </Field>
        </DialogBody>
        <DialogFooter>
          <ButtonV2 type="button" variant="neutral" disabled={submitting()} onClick={() => dialog.close()}>
            {language.t("common.cancel")}
          </ButtonV2>
          <ButtonV2 type="submit" variant="contrast" disabled={!message().trim() || submitting()}>
            {submitting()
              ? language.t("session.review.git.commitDialog.actionLoading")
              : language.t("session.review.git.commitDialog.action")}
          </ButtonV2>
        </DialogFooter>
      </form>
    </Dialog>
  )
}