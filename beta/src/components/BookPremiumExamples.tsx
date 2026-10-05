import { parseMarkdown } from "../core/markdown";
import { NovelOutline } from "./NovelOutline";
import { NovelCharacters } from "./NovelCharacters";
import { TitlePreview } from "./TitlePreview";
import { BeatBoard } from "./BeatBoard";
import { BeatPacing } from "./BeatPacing";
const noop = () => {};
export const sampleBook = parseMarkdown(
  `# Book 1 — The Coast\n\n## Chapter 1 — The dark\n\nMara counted the windows across the bay. One by one, their lights vanished. At the foot of the lighthouse, Eli waited with a brass gear in his hand.\n\n## Chapter 2 — The promise\n\nShe had spent years refusing his help. Tonight, with a boat lost in the channel, she could no longer afford to.\n\n## Chapter 3 — The light\n\nTogether they turned the crank. The beam swept out over the water, and a bell answered from the dark.`,
);
sampleBook.titlePage = {
  ...sampleBook.titlePage,
  title: "The Last Light",
  author: "Alex Morgan",
  credit: "",
  extra: { Dedication: "For those who keep a light in the window." },
};
const chapters = sampleBook.blocks.filter(
  (b) => b.kind === "section" && b.level === 2,
);
sampleBook.metadata.beats = chapters.map((b, i) => ({
  id: `book-beat-${i}`,
  title: ["The bay goes dark", "Accept the help", "Bring them home"][i],
  description: "",
  act: `Act ${["I", "II", "III"][i]}`,
  color: ["#3974c2", "#7b5eb5", "#54824d"][i],
  sceneId: b.id,
  groupSceneId: b.id,
}));
sampleBook.metadata.proseCharacters = [
  {
    id: "mara",
    name: "Mara",
    description: "The lighthouse keeper. Self-reliant to a fault.",
    role: "Protagonist",
    motivation: "Keep her promise to the fishing crews; learn to trust Eli.",
  },
  {
    id: "eli",
    name: "Eli",
    description:
      "Her estranged brother, carrying their father's unfinished work.",
    role: "Brother",
    motivation: "Repair the mechanism—and his relationship with Mara.",
  },
];
export function BookPremiumExamples() {
  return (
    <>
      <section className="showcase-feature">
        <small className="showcase-kicker">Your book · Included</small>
        <h3>A home for the whole manuscript</h3>
        <p>
          Start with your title, author and an optional dedication. Organize
          books and chapters in Outline, and bookmark places you want to
          revisit. Export to PDF, Word, EPUB or RTF.
        </p>
        <figure>
          <div className="book-premium-opening" inert aria-hidden="true">
            <TitlePreview value={sampleBook.titlePage} novel onEdit={noop} />
            <NovelOutline
              doc={sampleBook}
              onJump={noop}
              onAdd={noop}
              onBeats={noop}
            />
          </div>
          <figcaption>Book title page and outline example</figcaption>
        </figure>
      </section>
      <section className="showcase-feature">
        <small className="showcase-kicker">Character profiles · Premium</small>
        <h3>Keep your characters close</h3>
        <p>
          Keep track of their history, motivations, relationships and the
          details that make them distinct.
        </p>
        <figure>
          <div className="sample-insights" inert aria-hidden="true">
            <NovelCharacters doc={sampleBook} onChange={noop} />
          </div>
          <figcaption>Character profiles from The Last Light</figcaption>
        </figure>
      </section>
      <section className="showcase-feature">
        <small className="showcase-kicker">Beat Sheet · Premium</small>
        <h3>Plan across chapters</h3>
        <p>
          Arrange beats by act and chapter, connect them to passages, and follow
          the shape of your manuscript in the pacing graph.
        </p>
        <figure>
          <div
            className="premium-example sample-beat-sheet"
            inert
            aria-hidden="true"
          >
            <BeatBoard
              doc={sampleBook}
              onChange={noop}
              onAssign={noop}
              onRange={noop}
              onExport={noop}
              onExportCsv={noop}
            />
            <BeatPacing doc={sampleBook} onClose={noop} onRange={noop} inline />
          </div>
          <figcaption>Book beat sheet and pacing graph</figcaption>
        </figure>
      </section>
    </>
  );
}
