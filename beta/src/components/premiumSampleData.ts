import { parseFountain } from "../core/fountain";
import { analyzeScreenplay } from "../core/insights";

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
  beats: [
    {
      id: "sample-opening",
      title: "The bay goes dark",
      description: "Mara discovers the beacon has failed.",
      act: "Act I",
      color: "#76add9",
      sceneId: scenes[0].id,
    },
    {
      id: "sample-choice",
      title: "Trust the old mechanism",
      description: "Eli offers their father's gear; Mara must accept his help.",
      act: "Act II",
      color: "#c29ad0",
    },
    {
      id: "sample-return",
      title: "Bring them home",
      description: "Together they turn the light toward the last boat.",
      act: "Act III",
      color: "#91b378",
    },
  ],
};
export const sampleInsights = analyzeScreenplay(premiumSample);
