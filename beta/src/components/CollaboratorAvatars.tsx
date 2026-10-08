import type { LiveIdentity, LiveStatus } from "../collaboration/LiveClient";
import { Menu, MenuItem } from "./Menu";
import "./collaborator-avatars.css";

/** Presence belongs to the active document, including its other open windows. */
export function CollaboratorAvatars({
  self,
  status,
  mobile,
  onReveal,
}: {
  self?: LiveIdentity;
  status?: LiveStatus;
  mobile: boolean;
  onReveal: (clientId: number) => void;
}) {
  if (
    !self ||
    !status?.members.length ||
    !["live", "syncing", "readonly"].includes(status.phase)
  )
    return null;
  const writers = [self, ...status.members];
  const limit = mobile ? 2 : 4;
  return (
    <div className="header-collaborators" aria-label="Document collaborators">
      <Menu
        label="Writers in this document"
        anchored
        restoreFocusOnSelect={false}
        triggerContent={
          <span className="collaborator-avatar-stack" aria-hidden="true">
            {writers.slice(0, limit).map((writer, index) => {
              const words = writer.name.trim().split(/\s+/).filter(Boolean);
              const initials = words.length
                ? (
                    words[0][0] + (words.length > 1 ? words.at(-1)![0] : "")
                  ).toUpperCase()
                : "W";
              const color = /^#[0-9a-f]{6}$/i.test(writer.color)
                ? writer.color
                : "#7762bd";
              return (
                <span
                  className="collaborator-avatar"
                  key={index === 0 ? "self" : (writer.clientId ?? writer.id)}
                  title={`${writer.name}${index === 0 ? " · You" : ""}`}
                  style={{ backgroundColor: color }}
                >
                  {initials}
                </span>
              );
            })}
            {writers.length > limit && (
              <span className="collaborator-avatar collaborator-overflow">
                +{writers.length - limit}
              </span>
            )}
          </span>
        }
      >
        <small>{self.name} · You</small>
        {status.members.map((member) => (
          <MenuItem
            key={member.clientId ?? member.id}
            disabled={!member.editing || member.clientId === undefined}
            onClick={() => onReveal(member.clientId!)}
          >
            {member.name} ·{" "}
            {member.canEdit === false ? "Viewing" : "Show writing position"}
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
}
