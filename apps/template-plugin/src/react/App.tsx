import { Button, Input, Space, Typography } from "antd";
import type { ReactElement } from "react";
import { useMemo, useState } from "react";

export interface TemplateAppProps {
  readonly value: string;
  readonly onSave: (next: string) => Promise<void>;
}

export function TemplateApp({ value, onSave }: TemplateAppProps): ReactElement {
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const canSave = useMemo(() => text.trim().length > 0 && text !== value, [text, value]);

  const handleSave = async () => {
    setSaving(true);

    try {
      await onSave(text);
      setLastSavedAt(new Date().toLocaleTimeString());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="template-plugin-settings-card">
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          Template Plugin
        </Typography.Title>
        <Typography.Text type="secondary">
          Edit value and save to data.json via Obsidian loadData/saveData.
        </Typography.Text>
        <Input value={text} onChange={(event) => setText(event.target.value)} />
        <Space>
          <Button type="primary" loading={saving} onClick={handleSave} disabled={!canSave}>
            Save
          </Button>
          {lastSavedAt ? <Typography.Text type="secondary">Saved at {lastSavedAt}</Typography.Text> : null}
        </Space>
      </Space>
    </div>
  );
}
