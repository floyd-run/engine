export interface Resource {
  id: string;
  name: string;
  timezone: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  workspaceId: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}
