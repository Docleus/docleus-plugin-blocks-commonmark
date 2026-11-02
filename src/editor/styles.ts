/** Editor styles for the CommonMark blocks; injected while the plugin is loaded. */
export const COMMONMARK_EDITOR_CSS = `
.docleus-editor-content blockquote {
  margin: 14px 0; padding-left: 16px; border-left: 2px solid var(--ink, #111);
  color: var(--ink-2, #555); font-style: italic;
  /* CJK has no italic; never slant it synthetically. */
  font-synthesis-style: none;
}
.docleus-editor-content table { border-collapse: collapse; margin: 14px 0; font: var(--t-ui, 13px/18px system-ui, sans-serif); }
.docleus-editor-content td {
  min-width: 4rem; padding: 6px 10px; border-bottom: 1px solid var(--hair, #e6e6e3);
}
.docleus-editor-content tr:first-child td {
  font-weight: 600; border-bottom: 1px solid var(--ink, #111);
}
.docleus-editor-content hr { margin: 28px 0; border: 0; border-top: 1px solid var(--hair-2, #cfcfcc); }
.docleus-editor-content li[data-type] > div[data-node-view-wrapper] { display: block; }
.commonmark-list-item[data-checked] { display: flex; gap: 8px; align-items: baseline; }
.commonmark-list-item[data-checked] > div { flex: 1; }
.commonmark-list-item[data-checked] input { accent-color: var(--ink, #111); }
.docleus-editor-content li:has(> div > .commonmark-list-item[data-checked]) {
  list-style: none;
}
.commonmark-task.is-reading {
  flex: none; box-sizing: border-box; width: 13px; height: 13px; transform: translateY(1px);
  border: 1px solid var(--ink, #111); border-radius: 2px; background: var(--paper, #fff);
}
.commonmark-task.is-reading[aria-checked="true"] {
  background: var(--ink, #111) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 6.2l2.3 2.3 4.7-5' fill='none' stroke='white' stroke-width='1.6'/%3E%3C/svg%3E") center / 11px no-repeat;
}
.commonmark-code {
  display: flex; flex-direction: column; gap: 4px; margin: 14px 0; padding: 8px 12px 12px;
  border: 1px solid var(--hair, #e6e6e3); border-radius: var(--r, 3px); background: var(--rail, #f5f5f4);
}
.commonmark-code-lang {
  align-self: flex-start; width: 10rem; height: 24px; padding: 0 6px;
  border: 1px solid var(--hair-2, #cfcfcc); border-radius: 2px; background: var(--paper, #fff);
  font: var(--t-mono, 12px/18px ui-monospace, monospace);
}
.commonmark-code-value {
  width: 100%; box-sizing: border-box; padding: 4px 0; border: 0; resize: vertical;
  background: transparent; color: var(--ink, #111);
  font: 13px/1.55 var(--f-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
}
.commonmark-code-value:focus { outline: none; }
.commonmark-code.is-reading { gap: 2px; }
.commonmark-code.is-reading .commonmark-code-lang {
  width: auto; height: auto; padding: 0; border: 0; background: none; color: var(--ink-2, #555);
}
pre.commonmark-code-value { margin: 0; overflow-x: auto; white-space: pre; }
pre.commonmark-code-value code { font: inherit; background: none; padding: 0; }
.commonmark-image { max-width: 100%; vertical-align: bottom; }
.commonmark-image-missing {
  padding: 0 4px; border: 1px dashed var(--ink-2, #555); border-radius: 2px; color: var(--ink-2, #555);
}
.commonmark-settings { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
`;
