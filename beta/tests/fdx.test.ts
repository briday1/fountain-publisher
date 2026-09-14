import { describe, it, expect } from "vitest";
import { parseFdx, importScreenplay } from "../src/core/fdx";
import { exportFdx } from "../src/core/export";
import { emptyScreenplay } from "../src/core/model";
import { parseFountain, serializeFountain } from "../src/core/fountain";
describe("Final Draft import", () => {
  it("imports styled screenplay, scene numbers, dual dialogue, notes, and explicit page breaks", () => {
    const doc = parseFdx(
      `<?xml version="1.0"?><FinalDraft DocumentType="Script"><Content><Paragraph Type="Scene Heading" Number="12A"><Text>INT. CAFÉ - DAY</Text></Paragraph><Paragraph Type="Action"><Text Style="Bold+Italic">A voice</Text><Text> answers &amp; waits.</Text><ScriptNote><Paragraph><Text>Remember this.</Text></Paragraph></ScriptNote></Paragraph><Paragraph><DualDialogue><Paragraph Type="Character"><Text>MARA</Text></Paragraph><Paragraph Type="Dialogue"><Text>Hello.</Text></Paragraph><Paragraph Type="Character"><Text>RENÉE</Text></Paragraph><Paragraph Type="Dialogue"><Text>Hi.</Text></Paragraph></DualDialogue></Paragraph><Paragraph Type="Transition" StartsNewPage="Yes"><Text>CUT TO:</Text></Paragraph></Content><TitlePage><Content><Paragraph Alignment="Center"><Text>Two Voices</Text></Paragraph><Paragraph Alignment="Center"><Text>Written by</Text></Paragraph><Paragraph Alignment="Center"><Text>Renée Writer</Text></Paragraph><Paragraph Alignment="Left"><Text>writer@example.com</Text></Paragraph></Content></TitlePage></FinalDraft>`,
    );
    expect(doc.blocks.map((b) => b.kind)).toEqual([
      "scene",
      "action",
      "note",
      "character",
      "dialogue",
      "character",
      "dialogue",
      "pageBreak",
      "transition",
    ]);
    expect(doc.blocks[0].sceneNumber).toBe("12A");
    expect(doc.blocks[1].spans?.[0].marks).toEqual(["bold", "italic"]);
    expect(doc.blocks[5].dual).toBe(true);
    expect(doc.blocks[2].text).toBe("Remember this.");
    expect(doc.titlePage).toMatchObject({
      title: "Two Voices",
      credit: "Written by",
      author: "Renée Writer",
      contact: "writer@example.com",
    });
    expect(parseFountain(serializeFountain(doc))).toEqual(doc);
  });
  it("round-trips exported FDX and gives imported files a Fountain save name", () => {
    const doc = emptyScreenplay();
    doc.blocks = [
      {
        id: "1",
        kind: "action",
        text: "A 🦊 waits.",
        spans: [{ text: "A 🦊 ", marks: ["underline"] }, { text: "waits." }],
      },
    ];
    const imported = importScreenplay(exportFdx(doc), "Night.FDX");
    expect(imported.converted).toBe(true);
    expect(imported.name).toBe("Night.fountain");
    expect(imported.screenplay.blocks[0]).toMatchObject({
      kind: "action",
      text: "A 🦊 waits.",
      spans: doc.blocks[0].spans,
    });
  });
  it("rejects malformed XML, unrelated XML, and entities before replacing a draft", () => {
    for (const text of [
      "<FinalDraft>",
      "<something/>",
      '<!DOCTYPE FinalDraft [<!ENTITY x "boom">]><FinalDraft/>',
    ])
      expect(() => parseFdx(text)).toThrow();
  });
});
