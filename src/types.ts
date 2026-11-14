export type ViewMode = "projects" | "backups" | "settings";

export interface ProjectStats {
  total_files: number;
  included_files: number;
  ignored_files: number;
  included_bytes: number;
  ignored_bytes: number;
  gitignore_present: boolean;
  ryzignore_present: boolean;
  scanned_at: string;
}

export interface BackupRecord {
  id: string;
  project_id: string;
  project_name: string;
  file_id: string;
  file_name: string;
  size_bytes: number;
  file_count: number;
  created_at: string;
  web_view_link: string | null;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  added_at: string;
  stats: ProjectStats | null;
  backup_count: number;
  total_backed_up_bytes: number;
  last_backup: BackupRecord | null;
}

export interface DriveStatus {
  connected: boolean;
  email: string | null;
  name: string | null;
  picture: string | null;
  folder_id: string | null;
  folder_name: string;
}

export interface AppSettings {
  client_id: string;
  has_client_secret: boolean;
  folder_name: string;
  retention: number;
  compression_level: number;
  respect_gitignore: boolean;
  extra_ignore_patterns: string[];
}

export interface AppSnapshot {
  projects: Project[];
  backups: BackupRecord[];
  settings: AppSettings;
  drive: DriveStatus;
  version: string;
  data_dir: string;
}

export interface SettingsInput {
  folder_name: string;
  retention: number;
  compression_level: number;
  respect_gitignore: boolean;
  extra_ignore_patterns: string[];
  client_id?: string | null;
  client_secret?: string | null;
}

export interface IgnoredSample {
  path: string;
  pattern: string | null;
}

export interface ScanPreview {
  stats: ProjectStats;
  ignored_samples: IgnoredSample[];
  included_samples: string[];
  warnings: string[];
}

export interface BackupProgress {
  job_id: string;
  phase: "scanning" | "archiving" | "uploading" | "finalizing" | "done" | "error";
  percent: number;
  message: string;
  current: number;
  total: number;
  bytes_done: number;
  bytes_total: number;
}

export interface RestoreProgress {
  job_id: string;
  phase: "downloading" | "extracting" | "done" | "error";
  percent: number;
  message: string;
}

export interface RestoreResult {
  destination: string;
  file_count: number;
}

export interface BackupJobState {
  jobId: string;
  project: Project;
  status: "running" | "success" | "error" | "cancelled";
  progress: BackupProgress;
  record?: BackupRecord;
  error?: string;
}

export interface RestoreJobState {
  jobId: string;
  record: BackupRecord;
  status: "running" | "success" | "error";
  progress: RestoreProgress;
  result?: RestoreResult;
  error?: string;
}
