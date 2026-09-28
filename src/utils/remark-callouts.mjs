import { visit } from "unist-util-visit";

/**
 * Turns simple directive syntax written in plain Markdown into callout
 * boxes, so authors never touch HTML:
 *
 *   :::note
 *   This sensor operates at 5V.
 *   :::
 *
 *   :::warning
 *   Do not connect this pin directly to 5V on a 3.3V-only MCU.
 *   :::
 *
 * Supported types: note, tip, warning. Anything else is left as a plain
 * directive (rendered as nothing) so a typo doesn't silently swallow text.
 */
const LABELS = {
  note: "Note",
  tip: "Tip",
  warning: "Warning",
};

export function remarkCallouts() {
  return (tree) => {
    visit(tree, (node) => node.type === "containerDirective", (node) => {
      if (!["note", "tip", "warning"].includes(node.name)) return;

      const label = LABELS[node.name];
      node.data = node.data || {};
      node.data.hName = "div";
      node.data.hProperties = {
        className: `callout callout-${node.name}`,
        role: node.name === "warning" ? "alert" : "note",
      };

      // Prepend a visible label so the callout type is clear even without CSS.
      node.children.unshift({
        type: "paragraph",
        data: {
          hName: "p",
          hProperties: { className: "callout-label" },
        },
        children: [{ type: "text", value: label }],
      });
    });
  };
}
