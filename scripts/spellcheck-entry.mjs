import nspell from "nspell";

export function createSpellchecker(aff, dic) {
  return nspell(aff, dic);
}
