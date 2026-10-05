import { SceneOutline } from "./SceneOutline";
import { premiumSample } from "./premiumSampleData";
import { BeatBoard } from "./BeatBoard";
import { BeatPacing } from "./BeatPacing";
import { CharacterAnalytics } from "./CharacterAnalytics";
import { NovelOutline } from "./NovelOutline";
import { Bookmarks } from "./Bookmarks";
import type { Screenplay } from "../core/model";
import { analyzeScreenplay } from "../core/insights";
import { FileText } from "lucide-react";
const noop = () => {};
export function SampleOutline({ doc = premiumSample }: { doc?: Screenplay }) {
  const novel = doc.metadata.format === "markdown";
  return (
    <div
      className="premium-example"
      inert
      aria-hidden="true"
      data-sample-feature="Outline"
    >
      <div
        className={`sample-story-outline outline-panel${novel ? " novel-mode" : ""}`}
      >
        <div className="panel-heading">
          <div>
            <small>YOUR STORY</small>
            <h2>Outline</h2>
          </div>
        </div>
        <button className="outline-title" onClick={noop}>
          <FileText size={17} />
          <span>
            Title page<small>Edit details</small>
          </span>
        </button>
        {novel ? (
          <NovelOutline doc={doc} onJump={noop} onAdd={noop} onBeats={noop} />
        ) : (
          <SceneOutline
            doc={doc}
            onAddAct={noop}
            insights={analyzeScreenplay(doc)}
            onJump={noop}
            onAdd={noop}
          />
        )}
        <Bookmarks
          doc={doc}
          onChange={noop}
          onCapture={() => undefined}
          onJump={noop}
        />
      </div>
    </div>
  );
}
export function SampleBeatSheet() {
  return (
    <div className="sample-beat-sheet">
      <BeatBoard
        doc={premiumSample}
        onChange={noop}
        onAssign={noop}
        onRange={noop}
        onExport={noop}
        onExportCsv={noop}
      />
      <BeatPacing doc={premiumSample} onClose={noop} onRange={noop} inline />
    </div>
  );
}
export function SampleCharacterGantt() {
  return (
    <CharacterAnalytics
      doc={premiumSample}
      onCharacter={noop}
      onScene={noop}
      onClose={noop}
      inline
    />
  );
}
