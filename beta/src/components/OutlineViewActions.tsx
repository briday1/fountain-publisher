import type { DocumentWorkspace } from "../core/documentWorkspace";
import { Menu, MenuItem } from "./Menu";
export function OutlineViewActions({
  model,
  sectionId,
}: {
  model: DocumentWorkspace;
  sectionId: string;
}) {
  const open = (other: boolean, focus: boolean) => {
    const view = model.activeView;
    if (view) model.duplicate(view.id, other, sectionId, focus);
  };
  return (
    <span className="outline-view-actions">
      <Menu label="Section view actions">
        <MenuItem onClick={() => open(false, false)}>Open in new tab</MenuItem>
        <MenuItem onClick={() => open(true, false)}>
          Open in other pane
        </MenuItem>
        <MenuItem onClick={() => open(false, true)}>
          Focus this section in a tab
        </MenuItem>
        <MenuItem onClick={() => open(true, true)}>
          Focus this section in other pane
        </MenuItem>
      </Menu>
    </span>
  );
}
