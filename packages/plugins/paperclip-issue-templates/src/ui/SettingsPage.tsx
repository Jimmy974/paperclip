import { useState, useEffect, type FormEvent } from "react";
import {
  PLUGIN_ID,
  DEFAULT_TEMPLATE_ENTRIES,
  DEFAULT_KEYS,
  type TemplateEntry,
} from "../constants.js";

function hostFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  return fetch(path, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  }).then(async (response) => {
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Request failed: ${response.status}`);
    }
    return (await response.json()) as T;
  });
}

function useTemplateConfig() {
  const [entries, setEntries] = useState<TemplateEntry[]>([...DEFAULT_TEMPLATE_ENTRIES]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    hostFetchJson<{ configJson?: { entries?: TemplateEntry[] } | null } | null>(
      `/api/plugins/${PLUGIN_ID}/config`
    )
      .then((result) => {
        if (cancelled) return;
        const saved = result?.configJson?.entries;
        setEntries(saved && saved.length > 0 ? saved : [...DEFAULT_TEMPLATE_ENTRIES]);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  async function save(next: TemplateEntry[]) {
    setSaving(true);
    try {
      await hostFetchJson(`/api/plugins/${PLUGIN_ID}/config`, {
        method: "POST",
        body: JSON.stringify({ configJson: { entries: next } }),
      });
      setEntries(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setSaving(false);
    }
  }

  return { entries, setEntries, loading, saving, error, save };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const textareaStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid var(--border, #d1d5db)",
  fontSize: 13,
  fontFamily: "ui-monospace, monospace",
  background: "var(--background, transparent)",
  color: "var(--foreground, inherit)",
  resize: "vertical",
  lineHeight: 1.5,
};

const inputStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid var(--border, #d1d5db)",
  fontSize: 13,
  background: "var(--background, transparent)",
  color: "var(--foreground, inherit)",
};

const smallBtnStyle: React.CSSProperties = {
  fontSize: 12,
  padding: "2px 8px",
  borderRadius: 4,
  border: "1px solid var(--border, #d1d5db)",
  background: "transparent",
  color: "var(--muted-foreground, #6b7280)",
  cursor: "pointer",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SettingsPage() {
  const { entries, setEntries, loading, saving, error, save } = useTemplateConfig();
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  function updateEntry(index: number, field: keyof TemplateEntry, value: string) {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)));
  }

  function addType() {
    const newKey = `custom_${Date.now()}`;
    const newEntry: TemplateEntry = {
      key: newKey,
      label: "New Type",
      template: "**Description**\n*What is this about?*\n\n\n**Done when**\n*How will we know this is complete?*\n\n",
    };
    setEntries((prev) => [...prev, newEntry]);
    setActiveIndex(entries.length);
  }

  function removeType(index: number) {
    const entry = entries[index];
    const label = entry.label || entry.key;
    if (!window.confirm(`Remove "${label}"? This cannot be undone after saving.`)) return;
    setEntries((prev) => prev.filter((_, i) => i !== index));
    if (activeIndex >= entries.length - 1) {
      setActiveIndex(Math.max(0, entries.length - 2));
    }
  }

  function moveType(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= entries.length) return;
    setEntries((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setActiveIndex(target);
  }

  function resetType(index: number) {
    const entry = entries[index];
    const defaultEntry = DEFAULT_TEMPLATE_ENTRIES.find((d) => d.key === entry.key);
    if (!defaultEntry) return;
    if (!window.confirm(`Reset "${entry.label}" to its default template?`)) return;
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...defaultEntry } : e))
    );
  }

  function resetAll() {
    if (!window.confirm("Reset all types to defaults? Custom types will be removed.")) return;
    setEntries([...DEFAULT_TEMPLATE_ENTRIES]);
    setActiveIndex(0);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Validate keys are unique
    const keys = entries.map((e) => e.key);
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (dupes.length > 0) {
      alert(`Duplicate keys: ${[...new Set(dupes)].join(", ")}. Each type must have a unique key.`);
      return;
    }
    await save(entries);
    setSavedMessage("Saved");
    window.setTimeout(() => setSavedMessage(null), 2000);
  }

  if (loading) {
    return (
      <div style={{ fontSize: 13, opacity: 0.6, padding: 16 }}>
        Loading template config...
      </div>
    );
  }

  const active = entries[activeIndex];
  const isDefault = active ? DEFAULT_KEYS.has(active.key) : false;

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "grid", gap: 20, maxWidth: 760, padding: "8px 0" }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
          Issue Templates
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--muted-foreground, #6b7280)",
            lineHeight: 1.5,
          }}
        >
          Customize the markdown templates inserted when a user selects an issue
          type. You can edit the built-in types or add your own.
        </div>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid var(--border, #e5e7eb)",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {entries.map((entry, i) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setActiveIndex(i)}
            style={{
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: activeIndex === i ? 600 : 400,
              cursor: "pointer",
              border: "none",
              borderBottom:
                activeIndex === i
                  ? "2px solid var(--foreground, #111)"
                  : "2px solid transparent",
              background: "transparent",
              color:
                activeIndex === i
                  ? "var(--foreground, #111)"
                  : "var(--muted-foreground, #6b7280)",
            }}
          >
            {entry.label || entry.key}
            {!DEFAULT_KEYS.has(entry.key) && (
              <span
                style={{
                  fontSize: 10,
                  marginLeft: 4,
                  opacity: 0.5,
                  verticalAlign: "super",
                }}
              >
                custom
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={addType}
          style={{
            ...smallBtnStyle,
            margin: "4px 8px",
            fontWeight: 600,
            fontSize: 14,
            padding: "2px 10px",
          }}
          title="Add custom type"
        >
          +
        </button>
      </div>

      {/* Active entry editor */}
      {active && (
        <div style={{ display: "grid", gap: 12 }}>
          {/* Key + Label row */}
          <div style={{ display: "flex", gap: 12, alignItems: "end" }}>
            <div style={{ flex: "0 0 180px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Key</div>
              <input
                value={active.key}
                onChange={(e) => updateEntry(activeIndex, "key", e.target.value.replace(/\s+/g, "_").toLowerCase())}
                disabled={isDefault}
                style={{
                  ...inputStyle,
                  width: "100%",
                  opacity: isDefault ? 0.5 : 1,
                }}
                title={isDefault ? "Built-in type keys cannot be changed" : "Unique identifier (lowercase, no spaces)"}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Label</div>
              <input
                value={active.label}
                onChange={(e) => updateEntry(activeIndex, "label", e.target.value)}
                style={{ ...inputStyle, width: "100%" }}
                placeholder="Display name in the dropdown"
              />
            </div>
          </div>

          {/* Template editor */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600 }}>Template</div>
              <div style={{ display: "flex", gap: 6 }}>
                {activeIndex > 0 && (
                  <button type="button" onClick={() => moveType(activeIndex, -1)} style={smallBtnStyle} title="Move left">
                    &larr;
                  </button>
                )}
                {activeIndex < entries.length - 1 && (
                  <button type="button" onClick={() => moveType(activeIndex, 1)} style={smallBtnStyle} title="Move right">
                    &rarr;
                  </button>
                )}
                {isDefault && (
                  <button type="button" onClick={() => resetType(activeIndex)} style={smallBtnStyle}>
                    Reset to default
                  </button>
                )}
                {!isDefault && (
                  <button
                    type="button"
                    onClick={() => removeType(activeIndex)}
                    style={{ ...smallBtnStyle, color: "var(--destructive, #ef4444)" }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            <textarea
              value={active.template}
              onChange={(e) => updateEntry(activeIndex, "template", e.target.value)}
              rows={16}
              style={textareaStyle}
            />
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: 10,
            borderRadius: 6,
            border: "1px solid var(--destructive, #fca5a5)",
            fontSize: 13,
            color: "var(--foreground, inherit)",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: "8px 20px",
            borderRadius: 6,
            border: "none",
            background: saving ? "var(--muted, #e5e7eb)" : "var(--primary, #111)",
            color: saving
              ? "var(--muted-foreground, #9ca3af)"
              : "var(--primary-foreground, #fff)",
            fontWeight: 600,
            fontSize: 13,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={resetAll}
          style={smallBtnStyle}
        >
          Reset all to defaults
        </button>
        {savedMessage && (
          <span style={{ fontSize: 12, color: "var(--muted-foreground, #6b7280)" }}>
            {savedMessage}
          </span>
        )}
      </div>
    </form>
  );
}
