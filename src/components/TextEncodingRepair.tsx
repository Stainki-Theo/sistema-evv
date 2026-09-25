import { useEffect } from "react";
import { repairEncoding } from "@/lib/textEncoding";

function repairNode(root: Node) {
  // MutationObserver entrega o próprio Text recém-alterado. O TreeWalker não
  // inclui a raiz, então ele precisa ser tratado antes de percorrer os filhos.
  if (root.nodeType === Node.TEXT_NODE) {
    const current = root.nodeValue ?? "";
    const repaired = repairEncoding(current);
    if (repaired !== current) root.nodeValue = repaired;
    return;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();
  while (node) {
    const current = node.nodeValue ?? "";
    const repaired = repairEncoding(current);
    if (repaired !== current) node.nodeValue = repaired;
    node = walker.nextNode();
  }

  if (root instanceof Element) {
    for (const attribute of ["aria-label", "title", "placeholder"] as const) {
      const current = root.getAttribute(attribute);
      if (!current) continue;
      const repaired = repairEncoding(current);
      if (repaired !== current) root.setAttribute(attribute, repaired);
    }
    for (const input of root.querySelectorAll("input, textarea")) {
      const field = input as HTMLInputElement | HTMLTextAreaElement;
      const repaired = repairEncoding(field.value);
      if (repaired !== field.value) field.value = repaired;
    }
  }
}

/** Corrige visualmente textos legados que foram importados com codificação duplicada. */
export function TextEncodingRepair() {
  useEffect(() => {
    repairNode(document.body);
    const observer = new MutationObserver((changes) => {
      for (const change of changes) {
        if (change.type === "characterData") repairNode(change.target);
        for (const node of change.addedNodes) repairNode(node);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const repairAfterInteraction = () => queueMicrotask(() => repairNode(document.body));
    document.addEventListener("click", repairAfterInteraction, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", repairAfterInteraction, true);
    };
  }, []);
  return null;
}
