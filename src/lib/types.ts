// Shared domain types for LabNotes.

export type Note = {
  id: string;
  project_id: string;
  author_login: string;
  title: string;
  text: string | null;
  metric: string | null;
  value: number | null;
  delta: number | null;
  experiment: string | null;
  tags: string[];
  branch: string | null;
  commit_sha: string | null;
  verified: boolean;
  meta: Record<string, unknown> | null;
  created_at: number; // unix ms
};

export type Project = {
  id: string; // canonical 'github.com/org/repo'
  repo_full_name: string; // 'org/repo'
  created_at: number;
  note_count?: number;
  last_at?: number | null;
};

export type ApiToken = {
  id: string;
  user_login: string;
  name: string;
  token_prefix: string;
  created_at: number;
  last_used_at: number | null;
};

// The authenticated principal behind a request — a human session or an agent token.
export type Actor = {
  login: string;
  // GitHub access token used to call the GitHub API on the actor's behalf.
  githubToken: string;
  source: "session" | "api_token";
};
