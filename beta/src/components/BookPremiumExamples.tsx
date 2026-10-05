import { parseMarkdown } from "../core/markdown";
import { SampleOutline } from "./PremiumStoryExamples";
import { NovelCharacters } from "./NovelCharacters";
import { TitlePreview } from "./TitlePreview";
import { BeatBoard } from "./BeatBoard";
import { BeatPacing } from "./BeatPacing";
import { createSampleBeats } from "./premiumSampleData";
const noop = () => {};
export const sampleBook = parseMarkdown(
  `# Book 1 — The Coast

## Chapter 1 — The dark

Mara counted the windows across the bay. One by one, their lights vanished.

The fishing crews were still out there. She had promised them a light, and the beacon had never missed a night.

Eli came back from the flooded generator. Mara pointed him toward the hand crank: they would have to find another way.

## Chapter 2 — The promise

At the foot of the lighthouse, Eli waited with a brass gear in his hand. Their father had saved it for this moment.

Mara had spent years refusing his help. Now she asked him to lift the mechanism with her.

June called from the window. A boat was drifting toward the rocks, blind to the channel.

## Chapter 3 — The light

Together they turned the crank. The beam swept out over the water.

A bell answered from the dark. June watched the first boat slip safely past the rocks.

Mara kept her hands on the crank. There was one more boat out there, and they would keep turning until it was home.`,
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
sampleBook.metadata.beats = createSampleBeats(sampleBook, chapters);
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
            <SampleOutline doc={sampleBook} />
            <div className="sample-book-page novel-mode">
              <article className="screenplay-paper">
                <TitlePreview
                  value={sampleBook.titlePage}
                  novel
                  onEdit={noop}
                />
              </article>
            </div>
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
          <div
            className="sample-insights insights-panel"
            inert
            aria-hidden="true"
          >
            <div className="panel-heading">
              <div>
                <small>DOCUMENT</small>
                <h2>Insights</h2>
              </div>
            </div>
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
