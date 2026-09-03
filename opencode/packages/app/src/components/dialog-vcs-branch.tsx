import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { CheckboxV2 } from "@opencode-ai/ui/v2/checkbox-v2"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@opencode-ai/ui/v2/dialog-v2"
import { Field } from "@opencode-ai/ui/v2/field-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { createSignal } from "solid-js"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useLanguage } from "@/context/language"

export function DialogVcsBranch(props: { onSwitch: (name: string, create: boolean) => Promise<void> }) {
  const language = useLanguage()
  const dialog = useDialog()
  const [name, setName] = createSignal("")
  const [create, setCreate] = createSignal(false)
  const [error, setError] = createSignal<string>()
  const [submitting, setSubmitting] = createSignal(false)

  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    const value = name().trim()
    if (!value || submitting()) return

    setSubmitting(true)
    setError(undefined)
    try {
      await props.onSwitch(value, create())
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
          <DialogTitle>{language.t("session.review.git.branchDialog.title")}</DialogTitle>
        </DialogHeader>
        <DialogBody class="flex w-full flex-col gap-4 px-4 pt-4 pb-1">
          <Field>
            <Field.Label>{language.t("session.review.git.branchDialog.name")}</Field.Label>
            <TextInputV2
              autofocus
              appearance="large"
              class="!w-full"
              value={name()}
              placeholder={language.t("session.review.git.branchDialog.placeholder")}
              invalid={!!error()}
              onInput={(event) => {
                setName(event.currentTarget.value)
                if (error()) setError(undefined)
              }}
            />
            <div class="text-12-regular text-text-error" role="alert">
              {error()}
            </div>
          </Field>
          <CheckboxV2
            label={language.t("session.review.git.branchDialog.create")}
            checked={create()}
            onChange={setCreate}
          />
        </DialogBody>
        <DialogFooter>
          <ButtonV2 type="button" variant="neutral" disabled={submitting()} onClick={() => dialog.close()}>
            {language.t("common.cancel")}
          </ButtonV2>
          <ButtonV2 type="submit" variant="contrast" disabled={!name().trim() || submitting()}>
            {submitting()
              ? language.t("session.review.git.branchDialog.actionLoading")
              : language.t("session.review.git.branchDialog.action")}
          </ButtonV2>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
