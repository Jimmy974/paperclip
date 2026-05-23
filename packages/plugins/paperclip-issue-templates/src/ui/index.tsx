import { useState } from "react";
import { useHostContext, usePluginData, usePluginAction } from "@paperclipai/plugin-sdk/ui";
import { DEFAULT_TEMPLATE_ENTRIES, type TemplateEntry } from "../constants.js";

export { SettingsPage } from "./SettingsPage.js";

export function IssueTemplateToolbar() {
  const context = useHostContext();
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  const { data: entries } = usePluginData<TemplateEntry[]>("templates");
  const resolvedEntries: TemplateEntry[] = entries ?? DEFAULT_TEMPLATE_ENTRIES;

  const applyTemplate = usePluginAction("apply-template");

  const issueId = context.entityId;
  const companyId = context.companyId;

  if (context.entityType !== "issue" || !issueId || !companyId) {
    return null;
  }

  async function handleSelect(entry: TemplateEntry) {
    setOpen(false);
    if (
      !window.confirm(
        `Apply "${entry.label}" template? This will replace the current description.`
      )
    ) {
      return;
    }
    setApplying(true);
    try {
      await applyTemplate({ issueId, companyId, templateKey: entry.key });
    } catch (err) {
      window.alert(
        `Failed to apply template: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setApplying(false);
    }
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        disabled={applying}
        onClick={() => setOpen((v) => !v)}
        style={{
          fontSize: 13,
          padding: "4px 10px",
          borderRadius: 6,
          border: "1px solid var(--border, #d1d5db)",
          background: "transparent",
          color: applying
            ? "var(--muted-foreground, #9ca3af)"
            : "var(--foreground, currentColor)",
          cursor: applying ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: 4,
          whiteSpace: "nowrap",
        }}
      >
        {applying ? "Applying..." : "Template"}
        {!applying && <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>}
      </button>

      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 99 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              zIndex: 100,
              background: "var(--background, #fff)",
              border: "1px solid var(--border, #e5e7eb)",
              borderRadius: 8,
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              minWidth: 160,
              overflow: "hidden",
            }}
          >
            {resolvedEntries.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => void handleSelect(entry)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 14px",
                  fontSize: 13,
                  border: "none",
                  borderBottom: "1px solid var(--border, #f3f4f6)",
                  background: "transparent",
                  color: "var(--foreground, currentColor)",
                  cursor: "pointer",
                }}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
