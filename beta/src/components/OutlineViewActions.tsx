import type { DocumentWorkspace } from "../core/documentWorkspace";
import { Menu, MenuItem } from "./Menu";
export function OutlineViewActions({
  model,
  sectionId,
  premium = true,
  onPremium,
  onFocused,
  mobile = false,
}: {
  model: DocumentWorkspace;
  sectionId: string;
  premium?: boolean;
  onPremium?: () => void;
  onFocused?: () => void;
  mobile?: boolean;
}) {
  const open = (other: boolean, focus: boolean) => {
    if (focus && !premium) {
      onPremium?.();
      return;
    }
    const view = model.activeView;
    if (view) model.duplicate(view.id, other, sectionId, focus);
  };
  return (
    <span className="outline-view-actions">
      <Menu anchored label="Section view actions">
        <MenuItem
          onClick={() => {
            if (!premium) {
              onPremium?.();
              return;
            }
            const view = model.activeView;
            if (view) model.focusSection(view.id, sectionId);
            onFocused?.();
          }}
        >
          Focus this section{!premium ? " · Premium" : ""}
        </MenuItem>
        {!mobile && (
          <>
            <MenuItem onClick={() => open(false, false)}>
              Open in new tab
            </MenuItem>
            <MenuItem onClick={() => open(true, false)}>
              Open in other pane
            </MenuItem>
            <MenuItem onClick={() => open(false, true)}>
              Focus this section in a tab{!premium ? " · Premium" : ""}
            </MenuItem>
            <MenuItem onClick={() => open(true, true)}>
              Focus this section in other pane{!premium ? " · Premium" : ""}
            </MenuItem>
          </>
        )}
      </Menu>
    </span>
  );
}
