export interface Resource {
  id: string;
  name: string;
  timezone: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}
