import {
  Children,
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
  PenLine,
  PanelsTopLeft,
  Upload,
  ChevronDown,
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

/** Render the same commands on desktop and mobile; no duplicate action registry. */
export function ApplicationMenu({
  children,
  mobile,
  controls,
  filename,
}: {
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
  const action = (node: Command, key: string) =>
    cloneElement(node, {
      key,
      onClick: () => {
        // Close the native dialog before another command opens a dialog or focuses the editor.
        flushSync(() => setOpen(false));
        node.props.onClick?.();
      },
    });
  Children.forEach(open ? children : null, (child, index) => {
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
    Children.forEach(menu.props.children, (item, i) => {
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
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setSection("File");
          setOpen(true);
        }}
      >
        <FileText size={17} aria-hidden="true" /> File{" "}
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && (
        <Modal
          title={filename.replace(/\.fountain$/i, "")}
          eyebrow="YOUR WORKSPACE"
          onClose={close}
          className="mobile-command-panel"
        >
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
            {section === "Write" && mobileControls}
            <div className="mobile-command-grid">{groups[section]}</div>
          </section>
          <button className="mobile-resume" onClick={close}>
            Back to writing
          </button>
        </Modal>
      )}
    </nav>
  );
}
