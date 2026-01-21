export interface Resource {
  id: string;
  workspaceId: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  createdAt: string;
  updatedAt: string;
}
