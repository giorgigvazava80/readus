export type RegisteredRole = "reader" | "writer";

export type EffectiveRole =
  | "anonymous"
  | "reader"
  | "pending_writer"
  | "writer"
  | "redactor"
  | "admin"
  | "root";

export type WriterApplicationStatus = "pending" | "approved" | "rejected";

export type ContentStatus = "draft" | "approved" | "rejected";

export type ContentCategory = "books" | "chapters" | "poems" | "stories";

export interface MeUser {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  birth_date?: string | null;
  age?: number | null;
  profile_photo?: string | null;
  role_registered: RegisteredRole;
  is_email_verified: boolean;
  is_writer_approved: boolean;
  is_redactor: boolean;
  is_admin: boolean;
  forced_password_change: boolean;
  effective_role: EffectiveRole;
  permissions: {
    can_review_writer_applications: boolean;
    can_review_content: boolean;
    can_manage_content: boolean;
    can_manage_redactors: boolean;
    redactor_is_active: boolean;
  };
}

export interface WriterApplication {
  id: number;
  sample_text: string;
  sample_file: string | null;
  status: WriterApplicationStatus;
  review_comment: string;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ChapterDetail {
  id: number;
  title: string;
  order: number;
  body: string;
  auto_label?: string;
  status: ContentStatus;
  rejection_reason: string;
  is_deleted?: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentItem {
  id: number;
  public_slug?: string;
  title: string;
  description: string;
  is_anonymous: boolean;
  is_hidden: boolean;
  source_type: "manual" | "upload";
  upload_file: string | null;
  cover_image: string | null;
  status: ContentStatus;
  rejection_reason: string;
  created_at: string;
  updated_at: string;
  has_draft_chapters?: boolean;
  body?: string;
  extracted_text?: string;
  author_username?: string;
  author_name?: string;
  author_key?: string;
}

export interface ContentDetail extends ContentItem {
  body?: string;
  foreword?: string;
  afterword?: string;
  chapters?: ChapterDetail[];
  numbering_style?: "arabic" | "roman" | "separator";
  book?: number;
  order?: number;
  auto_label?: string;
}

export interface PublicAuthorSummary {
  key: string;
  display_name: string;
  username: string | null;
  profile_photo: string | null;
  works_count: number;
  books_count: number;
  stories_count: number;
  poems_count: number;
  is_anonymous: boolean;
}

export interface RedactorPermissions {
  can_review_writer_applications: boolean;
  can_review_content: boolean;
  can_manage_content: boolean;
  can_manage_redactors: boolean;
  is_active: boolean;
}

export interface RedactorUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  permissions: RedactorPermissions;
}

export interface NotificationItem {
  id: number;
  category: "verification" | "writer_application" | "content_review" | "system";
  title: string;
  message: string;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditLogItem {
  id: number;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string;
  description: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}
