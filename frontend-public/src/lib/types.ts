export type RegisteredRole = "reader" | "writer";

export type EffectiveRole =
  | "anonymous"
  | "reader"
  | "pending_writer"
  | "writer"
  | "redactor"
  | "admin"
  | "root";

export type WriterApplicationStatus = "pending" | "approved" | "rejected" | "canceled";

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
  nationality?: string;
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
  author_id?: number | null;
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
  id: number | null;
  key: string;
  display_name: string;
  username: string | null;
  profile_photo: string | null;
  works_count: number;
  books_count: number;
  stories_count: number;
  poems_count: number;
  follower_count?: number;
  is_following?: boolean;
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
  category:
    | "verification"
    | "writer_application"
    | "content_review"
    | "follow"
    | "like"
    | "reaction"
    | "comment"
    | "publication"
    | "system";
  title: string;
  message: string;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface FollowState {
  is_following: boolean;
  follower_count: number;
  author_id?: number;
}

export interface FollowingAuthorItem {
  author_id: number;
  author_username: string;
  author_display_name: string;
  profile_photo: string | null;
  followed_at: string;
  follower_count: number;
}

export interface TargetSummary {
  category: ContentCategory;
  id: number;
  identifier: string;
  title: string;
  excerpt: string;
  author_username: string | null;
  author_display_name: string;
  author_key: string | null;
  is_anonymous: boolean;
  cover_image: string | null;
  created_at: string;
  read_path: string;
  read_url: string;
}

export interface ReadingProgressItem {
  id: number;
  progress_percent: string;
  paragraph_index: number | null;
  cursor: string;
  last_position?: Record<string, unknown>;
  completed: boolean;
  started_at: string;
  updated_at: string;
  target: TargetSummary;
}

export interface ContinueReadingEntry {
  id: number;
  work_type: "books" | "stories" | "poems";
  work: TargetSummary;
  chapter: TargetSummary | null;
  progress_percent: string;
  last_position: Record<string, unknown>;
  last_read_at: string;
  target_read_path: string;
}

export interface ReactionSummary {
  likes_count: number;
  liked_by_me: boolean;
}

export interface ContentCommentItem {
  id: number;
  parent_comment: number | null;
  user_username: string;
  user_display_name: string;
  body: string;
  anchor_type: "block" | "paragraph";
  anchor_key: string;
  paragraph_index: number | null;
  excerpt: string;
  is_hidden: boolean;
  hidden_reason: string;
  created_at: string;
  updated_at: string;
  can_moderate: boolean;
  can_view_hidden: boolean;
  replies: ContentCommentItem[];
}

export interface TrendingItem extends TargetSummary {
  score: number;
  views: number;
  unique_readers: number;
  likes: number;
  comments: number;
}

export interface RecommendationItem extends TargetSummary {
  score: number;
  explain_reason: string;
}

export interface WriterAnalyticsEntry {
  category: ContentCategory;
  id: number;
  identifier: string;
  title: string;
  read_path: string;
  metrics: {
    views: number;
    unique_readers: number;
    likes: number;
    comments: number;
    completion_estimate: number;
    completion_rate: number;
  };
  chapters: Array<{
    id: number;
    title: string;
    identifier: string;
    order: number;
    read_path: string;
    metrics: {
      views: number;
      unique_readers: number;
      likes: number;
      comments: number;
      completion_estimate: number;
      completion_rate: number;
    };
  }>;
}

export interface WriterAnalyticsResponse {
  range: "7d" | "30d" | "all";
  generated_at: string;
  totals: {
    views: number;
    unique_readers: number;
    likes: number;
    comments: number;
  };
  works: WriterAnalyticsEntry[];
}

export interface AnalyticsMetricSnapshot {
  views: number;
  unique_readers: number;
  likes: number;
  comments: number;
  completions: number;
  avg_progress: number;
}

export interface WriterAnalyticsOverviewResponse {
  range: "7d" | "30d" | "all";
  generated_at: string;
  metrics: AnalyticsMetricSnapshot;
  follower_growth: number;
  reads_from_shares: number;
  reads_today: number;
  reads_7d: number;
}

export interface WriterAnalyticsChapterRow {
  chapter: TargetSummary;
  metrics: AnalyticsMetricSnapshot;
}

export interface WriterAnalyticsWorkRow {
  work: TargetSummary;
  metrics: AnalyticsMetricSnapshot;
  chapters: WriterAnalyticsChapterRow[];
}

export interface WriterAnalyticsWorksResponse {
  range: "7d" | "30d" | "all";
  sort: "views" | "likes" | "comments" | "completions";
  results: WriterAnalyticsWorkRow[];
}

export interface WriterAnalyticsWorkDetailResponse {
  range: "7d" | "30d" | "all";
  result: WriterAnalyticsWorkRow;
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
