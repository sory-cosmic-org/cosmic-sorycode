import { isRTL } from "@kobalte/core/i18n"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { createMemo, Show } from "solid-js"
import FileTree from "@/components/file-tree"
import { Drawer, DrawerClose, DrawerContent } from "@/components/ui/drawer"
import { useFile } from "@/context/file"
import { useLanguage } from "@/context/language"

// Mobile-only file explorer. Reuses the desktop FileTree against the real
// workspace filesystem; the desktop side panel stays untouched.
export function SessionMobileFilesDrawer(props: { open: () => boolean; onOpenChange: (open: boolean) => void; onSelect: (path: string) => void }) {
  const file = useFile()
  const language = useLanguage()
  const rtl = () => isRTL(language.intl())
  const nofiles = createMemo(() => {
    const state = file.tree.state("")
    if (!state?.loaded) return false
    return file.tree.children("").length === 0
  })

  return (
    <Drawer open={props.open()} onOpenChange={props.onOpenChange} side={rtl() ? "left" : "right"}>
      <DrawerContent aria-label={language.t("session.files.title")}>
        <div class="flex h-[52px] w-full shrink-0 items-center gap-2 border-b border-v2-border-border-muted p-4">
          <p class="min-w-0 flex-1 truncate text-[13px] font-[530] leading-5 tracking-[-0.04px] tabular-nums text-v2-text-text-base">
            {language.t("session.files.title")}
          </p>
          <DrawerClose
            as={IconButtonV2}
            type="button"
            size="small"
            variant="ghost-muted"
            aria-label={language.t("common.close")}
            icon={<IconV2 name="xmark-small" />}
          />
        </div>
        <div class="min-h-0 w-full flex-1 overflow-y-auto px-3 py-2">
          <Show
            when={!nofiles()}
            fallback={
              <div role="status" class="px-2 py-2 text-12-regular text-text-weak">
                {language.t("session.files.empty")}
              </div>
            }
          >
            <FileTree
              path=""
              draggable={false}
              onFileClick={(node) => {
                props.onSelect(node.path)
                props.onOpenChange(false)
              }}
            />
          </Show>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
