import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactElement, ReactNode } from "react";
import { flushSync } from "react-dom";
import {
  FileText,
  Github,
  Cloud,
  PenLine,
  PanelsTopLeft,
  Upload,
  Menu as MenuIcon,
} from "lucide-react";
import { Menu } from "./Menu";
import { Modal } from "./Modal";
import type { WritingToolbarProps } from "./WritingToolbar";
import "./mobile-command-panel.css";

type Command = ReactElement<{
  children?: ReactNode;
  onClick?: () => void;
  label?: string;
}>;
const sections = [
  ["File", FileText],
  ["Write", PenLine],
  ["View", PanelsTopLeft],
  ["Share", Upload],
] as const;
type Section = (typeof sections)[number][0];

// React's Children helpers do not descend into Fragments. Conditional product
// groups are transparent here so their headings, shortcuts and actions keep the
// same mobile behavior as directly rendered desktop commands.
function commandsIn(children: ReactNode): Command[] {
  const commands: Command[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const command = child as Command;
    if (command.type === Fragment)
      commands.push(...commandsIn(command.props.children));
    else commands.push(command);
  });
  return commands;
}

/** Render the same commands on desktop and mobile; no duplicate action registry. */
export function ApplicationMenu({
  simpleMobile = false,
  onSettings,
  onHelp,
  children,
  mobile,
  controls,
  filename,
}: {
  simpleMobile?: boolean;
  onSettings?: () => void;
  onHelp?: () => void;
  children: ReactNode;
  mobile: boolean;
  controls: ReactElement<WritingToolbarProps>;
  filename: string;
}) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<Section>("File");
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobile) setOpen(false);
  }, [mobile]);
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  if (!mobile)
    return (
      <nav className="menus" aria-label="Application menu">
        {children}
      </nav>
    );

  const groups: Record<Section, ReactNode[]> = {
    File: [],
    Write: [],
    View: [],
    Share: [],
  };
  const storageShortcuts: ReactNode[] = [];
  const action = (node: Command, key: string) =>
    cloneElement(node, {
      key,
      onClick: () => {
        // Close the native dialog before another command opens a dialog or focuses the editor.
        flushSync(() => setOpen(false));
        node.props.onClick?.();
      },
    });
  commandsIn(open ? children : null).forEach((child, index) => {
    if (!isValidElement(child)) return;
    const menu = child as Command;
    if (menu.type !== Menu) {
      groups.View.push(action(menu, `shortcut-${index}`));
      return;
    }
    let target: Section =
      menu.props.label === "File"
        ? "File"
        : menu.props.label === "View"
          ? "View"
          : "Write";
    commandsIn(menu.props.children).forEach((item, i) => {
      if (!isValidElement(item)) return;
      const command = item as Command;
      if (command.type === "small") {
        if (
          command.props.children === "CONNECTED STORAGE" ||
          command.props.children === "PUBLISH"
        )
          target = "Share";
        return;
      }
      if (command.type === "hr") return;
      const provider =
        command.props.children === "Open from GitHub…"
          ? { name: "GitHub", Icon: Github, detail: "Connect or browse" }
          : command.props.children === "Open from Google Drive…"
            ? { name: "Google Drive", Icon: Cloud, detail: "Connect or browse" }
            : undefined;
      if (provider) {
        storageShortcuts.push(
          action(
            <button aria-label={provider.name} onClick={command.props.onClick}>
              <provider.Icon size={22} aria-hidden="true" />
              <span>
                {provider.name}
                <small>{provider.detail}</small>
              </span>
            </button>,
            `storage-${provider.name}`,
          ),
        );
      }
      if (String(command.props.children).includes("Zen mode")) return;
      // Settings has a standalone shortcut below the menus.
      if (command.props.children === "Settings…") return;
      groups[target].push(action(command, `${index}-${i}`));
    });
  });
  const dismissThen = (fn: () => void) => () => {
    flushSync(() => setOpen(false));
    fn();
  };
  const mobileControls = cloneElement(controls, {
    showZen: false,
    onPreferences: (preferences) => {
      if (
        preferences.outline !== controls.props.preferences.outline ||
        preferences.insights !== controls.props.preferences.insights
      )
        flushSync(() => setOpen(false));
      controls.props.onPreferences(preferences);
    },
    onBeatSheet: dismissThen(controls.props.onBeatSheet),
    onBeatGuide: dismissThen(controls.props.onBeatGuide),
    onSearch: dismissThen(controls.props.onSearch),
    onPdf: dismissThen(controls.props.onPdf),
    onFullscreen: dismissThen(controls.props.onFullscreen),
  });
  return (
    <nav className="mobile-command-nav" aria-label="Application menu">
      <button
        ref={trigger}
        className="mobile-file-trigger"
        aria-label="File"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setSection("File");
          setOpen(true);
        }}
      >
        <MenuIcon size={22} aria-hidden="true" />
      </button>
      {open && (
        <Modal
          title={filename.replace(/\.(fountain|md|markdown)$/i, "")}
          eyebrow="YOUR WORKSPACE"
          onClose={close}
          className="mobile-command-panel"
        >
          {simpleMobile ? (
            <section
              className="mobile-command-content"
              aria-label="File commands"
            >
              <div className="mobile-command-grid">
                {groups.File.filter(
                  (node) =>
                    isValidElement(node) &&
                    ["Open…", "Save"].includes(
                      String((node as Command).props.children),
                    ),
                )}
                <button
                  onClick={dismissThen(() =>
                    controls.props.onPreferences({
                      ...controls.props.preferences,
                      outline: !controls.props.preferences.outline,
                      insights: false,
                    }),
                  )}
                >
                  Outline
                </button>
                <button
                  onClick={dismissThen(() =>
                    controls.props.onPreferences({
                      ...controls.props.preferences,
                      insights: !controls.props.preferences.insights,
                      outline: false,
                    }),
                  )}
                >
                  Insights
                </button>
                <button onClick={dismissThen(controls.props.onSearch)}>
                  Find and replace
                </button>
                {groups.Share}
                <button onClick={dismissThen(() => onSettings?.())}>
                  Settings
                </button>
              </div>
              <label className="mobile-zoom-control">
                Zoom
                <select
                  aria-label="Zoom"
                  value={controls.props.preferences.zoom}
                  onChange={(event) =>
                    controls.props.onPreferences({
                      ...controls.props.preferences,
                      zoom: Number(event.target.value),
                    })
                  }
                >
                  {[
                    ...new Set([
                      60,
                      70,
                      80,
                      90,
                      100,
                      110,
                      120,
                      125,
                      130,
                      140,
                      150,
                      175,
                      200,
                      controls.props.preferences.zoom,
                    ]),
                  ]
                    .sort((a, b) => a - b)
                    .map((zoom) => (
                      <option key={zoom} value={zoom}>
                        {zoom}%
                      </option>
                    ))}
                </select>
              </label>
              <details className="mobile-curated-tools">
                <summary>More actions</summary>
                <div className="mobile-command-grid">
                  {groups.File.filter(
                    (node) =>
                      isValidElement(node) &&
                      !["Open…", "Save"].includes(
                        String((node as Command).props.children),
                      ),
                  )}
                  <button onClick={dismissThen(controls.props.onBeatSheet)}>
                    Beat sheet
                  </button>
                  <button onClick={dismissThen(controls.props.onBeatGuide)}>
                    Beat guide
                  </button>
                  <button onClick={dismissThen(() => onHelp?.())}>Help</button>
                </div>
              </details>
            </section>
          ) : (
            <>
              <div
                className="mobile-command-sections"
                role="group"
                aria-label="Command categories"
              >
                {sections.map(([label, Icon]) => (
                  <button
                    key={label}
                    aria-pressed={section === label}
                    onClick={() => setSection(label)}
                  >
                    <Icon size={19} aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <section
                className="mobile-command-content"
                aria-label={`${section} commands`}
              >
                {section === "File" && storageShortcuts.length > 0 && (
                  <div
                    className="mobile-storage-shortcuts"
                    role="group"
                    aria-label="Connected storage"
                  >
                    {storageShortcuts}
                  </div>
                )}
                {section === "Write" && mobileControls}
                <div className="mobile-command-grid">{groups[section]}</div>
              </section>
            </>
          )}
          <button className="mobile-resume" onClick={close}>
            Back to writing
          </button>
        </Modal>
      )}
    </nav>
  );
}
