import { parseFountain } from "../core/fountain";
import { analyzeScreenplay } from "../core/insights";
import type { Beat, Screenplay, ScriptBlock } from "../core/model";

const storyBeats = [
  [
    ["The bay goes dark", "Mara discovers that the beacon has failed."],
    [
      "A promise to keep",
      "She refuses to leave the fishing crews without a light.",
    ],
    [
      "Find another way",
      "The generator is flooded. Mara turns to the hand crank.",
    ],
  ],
  [
    [
      "The missing gear",
      "Eli brings the part their father kept for this moment.",
    ],
    ["Accept the help", "Mara lets her brother help lift the mechanism."],
    [
      "A boat near the rocks",
      "June spots the boat; there is no time to spare.",
    ],
  ],
  [
    ["Restore the beam", "The light sweeps across the channel again."],
    ["An answering bell", "The first crew signals that they are safe."],
    ["Keep turning", "Mara stays at the crank until the last boat is home."],
  ],
];

/** Real passage assignments let the board and graph show several beats per scene/chapter. */
export function createSampleBeats(
  doc: Screenplay,
  sections: ScriptBlock[],
): Beat[] {
  return sections.flatMap((section, actIndex) => {
    const start = doc.blocks.indexOf(section) + 1;
    const next = doc.blocks.indexOf(sections[actIndex + 1]);
    const passages = doc.blocks
      .slice(start, next < 0 ? undefined : next)
      .filter((block) => block.kind === "action" || block.kind === "dialogue");
    return storyBeats[actIndex].map(([title, description], index) => {
      const split =
        passages.length === 4 && actIndex === 1
          ? [0, 2, 3, 4]
          : [
              0,
              Math.floor(passages.length / 3),
              Math.floor((2 * passages.length) / 3),
              passages.length,
            ];
      const first = passages[split[index]],
        last = passages[split[index + 1] - 1];
      return {
        id: `sample-${actIndex}-${index}`,
        title,
        description,
        act:
          doc.metadata.format === "markdown"
            ? ""
            : `Act ${["I", "II", "III"][actIndex]}`,
        color: ["#76add9", "#c29ad0", "#91b378"][actIndex],
        groupSceneId: section.id,
        range: {
          start: { blockId: first.id, offset: 0 },
          end: { blockId: last.id, offset: last.text.length },
        },
      };
    });
  });
}

// Fictional, isolated data shared by the previews and plan illustrations.
// Never accept the active document or editor as input here.
export const premiumSample = parseFountain(`Title: The Last Light
Author: WriteShape sample

EXT. LIGHTHOUSE - DUSK

MARA climbs the salt-worn steps. Across the bay, every window goes dark.

MARA
The beacon has never missed a night. We are not starting now.

ELI
The generator is underwater. What do you want me to do?

MARA
Find the hand crank. We promised them a light.

INT. LANTERN ROOM - NIGHT

A cracked lens turns slowly above them. Eli holds a small brass gear.

ELI
This belonged to Dad. He said it would fit when we needed it.

MARA
Then help me lift it.

JUNE
There is a boat in the channel. They cannot see the rocks.

EXT. LIGHTHOUSE - DAWN

The beam sweeps across the water. A fishing boat answers with a bell.

JUNE
They made it home.

MARA
Keep turning. There is one more out there.
`);
const scenes = premiumSample.blocks.filter((block) => block.kind === "scene");
premiumSample.metadata = {
  version: 1,
  premise:
    "When a storm cuts the power, two estranged siblings must restore a lighthouse before a fishing boat reaches the rocks.",
  notes:
    "Let Mara ask for help before the light returns. Give June the first sight of the boat.",
  beats: createSampleBeats(premiumSample, scenes),
};
export const sampleInsights = analyzeScreenplay(premiumSample);
