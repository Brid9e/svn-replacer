export interface ContextPayload {
  source: "context";
  action: string;
  url: string;
  name: string;
}

export interface ToolbarPayload {
  source: "toolbar";
  action: string;
}

export type ActionPayload = ContextPayload | ToolbarPayload;
