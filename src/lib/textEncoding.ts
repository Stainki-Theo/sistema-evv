const portugueseCharacters = "áàâãäÁÀÂÃÄéêÉÊíÍóôõÓÔÕúüÚÜçÇ";
const replacements: Record<string, string> = Object.fromEntries(
  [...portugueseCharacters].map((fixed) => [
    String.fromCharCode(...new TextEncoder().encode(fixed)),
    fixed,
  ]),
);

Object.assign(replacements, {
  "Â°": "°", "Â·": "·", "Âº": "º", "Âª": "ª",
  "â€“": "–", "â€”": "—", "â€œ": "“", "â€": "”", "â€™": "’", "â€¦": "…",
});

export function repairEncoding(value: string) {
  let result = value;
  for (const [broken, fixed] of Object.entries(replacements)) {
    result = result.split(broken).join(fixed);
  }
  return result;
}
