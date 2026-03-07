import type {
  AnalyticsMetricSnapshot,
  AuditLogItem,
  ContinueReadingEntry,
  ContentCommentItem,
  ContentCategory,
  ContentDetail,
  ContentItem,
  ContentStatus,
  FollowState,
  FollowingAuthorItem,
  MeUser,
  NotificationItem,
  PaginatedResponse,
  PublicAuthorSummary,
  ReactionSummary,
  RecommendationItem,
  ReadingProgressItem,
  RedactorUser,
  RegisteredRole,
  TrendingItem,
  WriterAnalyticsOverviewResponse,
  WriterAnalyticsWorkDetailResponse,
  WriterAnalyticsWorksResponse,
  WriterAnalyticsResponse,
  WriterApplication,
  WriterApplicationStatus,
} from "@/lib/types";

const defaultApiUrl = typeof window !== 'undefined' ? `http://${window.location.hostname}:9000` : "http://localhost:9000";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || defaultApiUrl).replace(/\/$/, "");

export function resolveMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^(blob:|data:)/i.test(path)) return path;

  let resolved = path;
  if (/^https?:/i.test(path)) {
    resolved = path;
  } else if (path.startsWith("//")) {
    resolved = `${window.location.protocol}${path}`;
  } else {
    resolved = `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  }

  if (typeof window !== "undefined" && window.location.protocol === "https:" && /^http:\/\//i.test(resolved)) {
    return resolved.replace(/^http:\/\//i, "https://");
  }

  return resolved;
}

const ACCESS_TOKEN_KEY = "qa_access_token";
const REFRESH_TOKEN_KEY = "qa_refresh_token";
const ME_KEY = "qa_me";
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000);

type QueryValue = string | number | boolean | undefined;

interface QueryParams {
  [key: string]: QueryValue;
}

interface LoginResponse {
  access?: string;
  refresh?: string;
  key?: string;
}

interface VerifyEmailResponse {
  detail?: string;
  access?: string;
  refresh?: string;
  key?: string;
}

interface RegisterPayload {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  password2: string;
  role: RegisteredRole;
}

interface WriterApplicationPayload {
  sampleText?: string;
  sampleFile?: File | null;
}

interface RedactorPayload {
  user_id?: number;
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  password?: string;
  can_review_writer_applications?: boolean;
  can_review_content?: boolean;
  can_manage_content?: boolean;
  can_manage_redactors?: boolean;
  is_active?: boolean;
}

export interface ProfileUpdatePayload {
  first_name?: string;
  last_name?: string;
  username?: string;
  birth_date?: string | null;
  nationality?: string;
  profile_photo?: File | null;
  remove_profile_photo?: boolean;
}

export interface ContentListFilters {
  mine?: boolean;
  status?: ContentStatus;
  q?: string;
  author?: string;
  deleted?: boolean;
  page?: number;
  date_from?: string;
  date_to?: string;
  book?: number;
  requiresAuth?: boolean;
}

export interface BookCreatePayload {
  title: string;
  description?: string;
  foreword?: string;
  afterword?: string;
  numbering_style?: "arabic" | "roman" | "separator";
  source_type?: "manual" | "upload";
  upload_file?: File | null;
  cover_image?: File | null;
  is_anonymous?: boolean;
  is_hidden?: boolean;
}

export interface TextContentPayload {
  title: string;
  description?: string;
  body?: string;
  source_type?: "manual" | "upload";
  upload_file?: File | null;
  cover_image?: File | null;
  is_anonymous?: boolean;
  is_hidden?: boolean;
}

export interface ChapterPayload {
  book: number;
  title?: string;
  order: number;
  body?: string;
}

export interface ReadingProgressPayload {
  progress_percent?: number;
  paragraph_index?: number | null;
  cursor?: string;
  completed?: boolean;
}

export interface ReadingProgressUpsertPayload {
  work_id: number;
  chapter_id?: number | null;
  work_type?: "books" | "stories" | "poems";
  progress_percent: number;
  last_position?: Record<string, unknown>;
}

export type EngagementTargetType = "work" | "chapter";
export type WorkTypeFilter = "books" | "stories" | "poems";

function dispatchAuthChanged() {
  window.dispatchEvent(new Event("auth-changed"));
}

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status = 0, payload: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  if (init.signal) {
    if (init.signal.aborted) {
      controller.abort();
    } else {
      init.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function buildQueryString(params?: QueryParams): string {
  if (!params) {
    return "";
  }

  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") {
      return;
    }
    query.append(key, String(value));
  });

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

function formatApiError(payload: unknown): string {
  if (!payload) {
    return "Request failed.";
  }

  if (typeof payload === "string") {
    return payload;
  }

  if (typeof payload === "object") {
    const detail = (payload as { detail?: string }).detail;
    if (detail) {
      return detail;
    }

    const messages = Object.entries(payload as Record<string, unknown>).map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: ${value.join(", ")}`;
      }
      return `${key}: ${String(value)}`;
    });

    if (messages.length > 0) {
      return messages.join(" ");
    }
  }

  return "Request failed.";
}

function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function setAccessToken(token: string | null) {
  if (!token) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    return;
  }
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

function setRefreshToken(token: string | null) {
  if (!token) {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    return;
  }
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

function storeMe(user: MeUser | null, notify = true) {
  const previous = localStorage.getItem(ME_KEY);
  const next = user ? JSON.stringify(user) : null;

  if (!next) {
    localStorage.removeItem(ME_KEY);
  } else {
    localStorage.setItem(ME_KEY, next);
  }

  if (notify && previous !== next) {
    dispatchAuthChanged();
  }
}

export function getStoredMe(): MeUser | null {
  const raw = localStorage.getItem(ME_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as MeUser;
  } catch {
    return null;
  }
}

export function clearAuthData() {
  setAccessToken(null);
  setRefreshToken(null);
  storeMe(null);
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}

async function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) {
    return false;
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE_URL}/auth/token/refresh/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ refresh }),
    });
  } catch {
    return false;
  }

  if (!response.ok) {
    clearAuthData();
    return false;
  }

  const payload = (await response.json()) as { access: string };
  setAccessToken(payload.access);
  return true;
}

async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  requiresAuth = false,
  retryOnUnauthorized = true,
): Promise<T> {
  const headers = new Headers(init.headers || {});
  const isFormData = init.body instanceof FormData;

  headers.set("Accept", "application/json");
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (requiresAuth) {
    const accessToken = getAccessToken();
    if (!accessToken) {
      throw new ApiError("Please sign in first.", 401);
    }
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new ApiError("Request timed out. Please try again.", 408);
    }
    throw new ApiError("Network error. Check your connection and try again.", 0);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    if (response.status === 401 && requiresAuth && retryOnUnauthorized) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return apiRequest<T>(path, init, requiresAuth, false);
      }
    }

    throw new ApiError(formatApiError(payload), response.status, payload);
  }

  return payload as T;
}

function asPaginated<T>(payload: PaginatedResponse<T> | T[]): PaginatedResponse<T> {
  if (Array.isArray(payload)) {
    return {
      count: payload.length,
      next: null,
      previous: null,
      results: payload,
    };
  }
  return payload;
}

export async function login(username: string, password: string): Promise<void> {
  const normalized = username.trim();
  const loginPayload = normalized.includes("@")
    ? { email: normalized, password }
    : { username: normalized, password };

  const response = await apiRequest<LoginResponse>("/auth/login/", {
    method: "POST",
    body: JSON.stringify(loginPayload),
  });

  const access = response.access || response.key;
  if (!access) {
    throw new Error("Login succeeded but no access token was returned.");
  }

  setAccessToken(access);
  if (response.refresh) {
    setRefreshToken(response.refresh);
  }

  dispatchAuthChanged();
}

export async function loginWithGoogleCode(code: string, redirectUri?: string): Promise<void> {
  const payload: { code: string; redirect_uri?: string } = { code };
  if (redirectUri) {
    payload.redirect_uri = redirectUri;
  }

  const response = await apiRequest<LoginResponse>("/auth/social/google/", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const access = response.access || response.key;
  if (!access) {
    throw new Error("Google login succeeded but no access token was returned.");
  }

  setAccessToken(access);
  if (response.refresh) {
    setRefreshToken(response.refresh);
  }

  dispatchAuthChanged();
}

export async function register(payload: RegisterPayload): Promise<void> {
  await apiRequest("/auth/registration/", {
    method: "POST",
    body: JSON.stringify({
      username: payload.username,
      email: payload.email,
      first_name: payload.firstName,
      last_name: payload.lastName,
      password1: payload.password,
      password2: payload.password2,
      role: payload.role,
    }),
  });
}

export async function verifyEmail(key: string): Promise<VerifyEmailResponse> {
  const response = await apiRequest<VerifyEmailResponse>("/auth/registration/verify-email/", {
    method: "POST",
    body: JSON.stringify({ key }),
  });

  const access = response.access || response.key;
  if (access) {
    setAccessToken(access);
    if (response.refresh) {
      setRefreshToken(response.refresh);
    }
    dispatchAuthChanged();
  }

  return response;
}

export async function resendVerification(email: string): Promise<void> {
  await apiRequest("/auth/registration/resend-email/", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await apiRequest("/auth/password/reset/", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function confirmPasswordReset(payload: {
  uid: string;
  token: string;
  new_password1: string;
  new_password2: string;
}): Promise<void> {
  await apiRequest("/auth/password/reset/confirm/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function changePassword(payload: {
  new_password1: string;
  new_password2: string;
  old_password: string;
}): Promise<void> {
  await apiRequest(
    "/auth/password/change/",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    true,
  );
}

export async function fetchMe(): Promise<MeUser | null> {
  try {
    const user = await apiRequest<MeUser>("/api/accounts/me/", { method: "GET" }, true);
    storeMe(user, false);
    return user;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      clearAuthData();
      return null;
    }

    if (error instanceof ApiError && (error.status === 0 || error.status === 408)) {
      return getStoredMe();
    }

    return null;
  }
}

export async function updateProfile(payload: ProfileUpdatePayload): Promise<void> {
  const shouldUseMultipart = payload.profile_photo instanceof File || payload.remove_profile_photo === true;

  if (shouldUseMultipart) {
    const form = new FormData();
    if (payload.username !== undefined) form.append("username", payload.username);
    if (payload.first_name !== undefined) form.append("first_name", payload.first_name);
    if (payload.last_name !== undefined) form.append("last_name", payload.last_name);
    if (payload.birth_date !== undefined) form.append("birth_date", payload.birth_date === null ? "" : payload.birth_date);
    if (payload.nationality !== undefined) form.append("nationality", payload.nationality);
    if (payload.profile_photo instanceof File) form.append("profile_photo", payload.profile_photo);
    if (payload.remove_profile_photo) form.append("remove_profile_photo", "true");

    await apiRequest(
      "/api/accounts/me/",
      {
        method: "PATCH",
        body: form,
      },
      true,
    );
    return;
  }

  await apiRequest(
    "/api/accounts/me/",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    true,
  );
}

export async function logout(): Promise<void> {
  const refresh = getRefreshToken();

  try {
    await apiRequest(
      "/auth/logout/",
      {
        method: "POST",
        body: JSON.stringify(refresh ? { refresh } : {}),
      },
      true,
      false,
    );
  } catch {
    // Ignore API logout failures and clear local auth state.
  }

  clearAuthData();
}

export async function submitWriterApplication(payload: WriterApplicationPayload): Promise<WriterApplication> {
  const form = new FormData();
  if (payload.sampleText) {
    form.append("sample_text", payload.sampleText);
  }
  if (payload.sampleFile) {
    form.append("sample_file", payload.sampleFile);
  }

  return apiRequest<WriterApplication>(
    "/api/accounts/writer-application/",
    {
      method: "POST",
      body: form,
    },
    true,
  );
}

export async function fetchMyWriterApplications(page = 1): Promise<PaginatedResponse<WriterApplication>> {
  const payload = await apiRequest<PaginatedResponse<WriterApplication> | WriterApplication[]>(
    `/api/accounts/writer-application/my/${buildQueryString({ page })}`,
    { method: "GET" },
    true,
  );
  return asPaginated(payload);
}

export async function cancelWriterApplication(id: number): Promise<WriterApplication> {
  return apiRequest<WriterApplication>(
    `/api/accounts/writer-application/${id}/cancel/`,
    { method: "POST" },
    true,
  );
}

export async function fetchPendingWriterApplications(page = 1, q = ""): Promise<PaginatedResponse<WriterApplication>> {
  const payload = await apiRequest<PaginatedResponse<WriterApplication> | WriterApplication[]>(
    `/api/accounts/writer-application/pending/${buildQueryString({ page, q })}`,
    { method: "GET" },
    true,
  );
  return asPaginated(payload);
}

export async function reviewWriterApplication(
  id: number,
  status: WriterApplicationStatus,
  reviewComment = "",
): Promise<void> {
  await apiRequest(
    `/api/accounts/writer-application/${id}/review/`,
    {
      method: "PATCH",
      body: JSON.stringify({ status, review_comment: reviewComment }),
    },
    true,
  );
}


function appendFormValue(form: FormData, key: string, value: string | number | boolean | File | null | undefined) {
  if (value === undefined || value === null) {
    return;
  }
  if (value instanceof File) {
    form.append(key, value);
    return;
  }
  form.append(key, String(value));
}

function resolveTextSourceType(payload: TextContentPayload): "manual" | "upload" {
  return payload.source_type || (payload.upload_file ? "upload" : "manual");
}

function resolveBookSourceType(payload: Partial<BookCreatePayload>): "manual" | "upload" {
  return payload.source_type || (payload.upload_file ? "upload" : "manual");
}

function sanitizeEditableHtmlForTransport(value: string | undefined): string {
  if (!value) {
    return "";
  }
  return value.trim();
}

function buildTextContentBody(payload: TextContentPayload): FormData {
  const sourceType = resolveTextSourceType(payload);
  const form = new FormData();
  appendFormValue(form, "title", payload.title);
  appendFormValue(form, "description", payload.description || "");
  appendFormValue(form, "source_type", sourceType);
  if (payload.is_anonymous !== undefined) appendFormValue(form, "is_anonymous", payload.is_anonymous);
  if (sourceType === "upload") {
    appendFormValue(form, "upload_file", payload.upload_file || null);
  } else {
    appendFormValue(form, "body", sanitizeEditableHtmlForTransport(payload.body));
  }
  if (payload.cover_image) {
    appendFormValue(form, "cover_image", payload.cover_image);
  }
  return form;
}

function buildBookBody(payload: Partial<BookCreatePayload>): FormData {
  const sourceType = resolveBookSourceType(payload);
  const form = new FormData();
  appendFormValue(form, "title", payload.title);
  appendFormValue(form, "description", payload.description || "");
  appendFormValue(form, "foreword", payload.foreword || "");
  appendFormValue(form, "afterword", payload.afterword || "");
  appendFormValue(form, "numbering_style", payload.numbering_style || "separator");
  appendFormValue(form, "source_type", sourceType);
  if (payload.is_anonymous !== undefined) appendFormValue(form, "is_anonymous", payload.is_anonymous);
  if (sourceType === "upload") {
    appendFormValue(form, "upload_file", payload.upload_file || null);
  } else {
    appendFormValue(form, "foreword", sanitizeEditableHtmlForTransport(payload.foreword));
    appendFormValue(form, "afterword", sanitizeEditableHtmlForTransport(payload.afterword));
  }
  if (payload.cover_image) {
    appendFormValue(form, "cover_image", payload.cover_image);
  }
  return form;
}

export async function fetchContent(
  category: ContentCategory,
  filters: ContentListFilters = {},
): Promise<PaginatedResponse<ContentItem>> {
  const requiresAuth =
    filters.requiresAuth ?? Boolean(filters.mine || (filters.status && filters.status !== "approved"));

  const payload = await apiRequest<PaginatedResponse<ContentItem> | ContentItem[]>(
    `/api/content/${category}/${buildQueryString({
      mine: filters.mine ? 1 : undefined,
      status: filters.status,
      q: filters.q,
      author: filters.author,
      deleted: filters.deleted ? 1 : undefined,
      page: filters.page,
      date_from: filters.date_from,
      date_to: filters.date_to,
      book: filters.book,
    })}`,
    { method: "GET" },
    requiresAuth,
  );
  return asPaginated(payload);
}

export async function fetchPublicAuthors(params: {
  page?: number;
  q?: string;
} = {}): Promise<PaginatedResponse<PublicAuthorSummary>> {
  const payload = await apiRequest<PaginatedResponse<PublicAuthorSummary> | PublicAuthorSummary[]>(
    `/api/content/authors/${buildQueryString({
      page: params.page,
      q: params.q,
    })}`,
    { method: "GET" },
  );
  return asPaginated(payload);
}

export async function fetchPublicAuthorDetail(authorKey: string): Promise<PublicAuthorSummary> {
  return apiRequest<PublicAuthorSummary>(
    `/api/content/authors/${encodeURIComponent(authorKey)}/`,
    { method: "GET" },
  );
}

export async function fetchContentDetail(
  category: ContentCategory,
  id: number | string,
  options: { requiresAuth?: boolean } = {},
): Promise<ContentDetail> {
  return apiRequest<ContentDetail>(`/api/content/${category}/${id}/`, { method: "GET" }, Boolean(options.requiresAuth));
}

export async function createBook(payload: BookCreatePayload): Promise<ContentDetail> {
  return apiRequest<ContentDetail>(
    "/api/content/books/",
    {
      method: "POST",
      body: buildBookBody(payload),
    },
    true,
  );
}

export async function updateBook(id: number, payload: Partial<BookCreatePayload>): Promise<ContentDetail> {
  const form = new FormData();
  if (payload.title !== undefined) appendFormValue(form, "title", payload.title);
  if (payload.description !== undefined) appendFormValue(form, "description", payload.description);
  if (payload.foreword !== undefined) appendFormValue(form, "foreword", sanitizeEditableHtmlForTransport(payload.foreword));
  if (payload.afterword !== undefined) appendFormValue(form, "afterword", sanitizeEditableHtmlForTransport(payload.afterword));
  if (payload.numbering_style !== undefined) appendFormValue(form, "numbering_style", payload.numbering_style);
  if (payload.source_type !== undefined) appendFormValue(form, "source_type", payload.source_type);
  if (payload.is_anonymous !== undefined) appendFormValue(form, "is_anonymous", payload.is_anonymous);
  if (payload.upload_file) appendFormValue(form, "upload_file", payload.upload_file);
  if (payload.cover_image) appendFormValue(form, "cover_image", payload.cover_image);
  if (payload.is_hidden !== undefined) appendFormValue(form, "is_hidden", payload.is_hidden);

  return apiRequest<ContentDetail>(
    `/api/content/books/${id}/`,
    { method: "PATCH", body: form },
    true,
  );
}

export async function createPoem(payload: TextContentPayload): Promise<ContentDetail> {
  return apiRequest<ContentDetail>(
    "/api/content/poems/",
    {
      method: "POST",
      body: buildTextContentBody(payload),
    },
    true,
  );
}

export async function updatePoem(id: number, payload: Partial<TextContentPayload>): Promise<ContentDetail> {
  const form = new FormData();
  const sourceType = resolveTextSourceType(payload as TextContentPayload);
  if (payload.title !== undefined) appendFormValue(form, "title", payload.title);
  if (payload.description !== undefined) appendFormValue(form, "description", payload.description);
  appendFormValue(form, "source_type", sourceType);
  if (payload.is_anonymous !== undefined) appendFormValue(form, "is_anonymous", payload.is_anonymous);
  if (sourceType === "upload") {
    if (payload.upload_file) appendFormValue(form, "upload_file", payload.upload_file);
  } else {
    if (payload.body !== undefined) appendFormValue(form, "body", sanitizeEditableHtmlForTransport(payload.body));
  }
  if (payload.cover_image) appendFormValue(form, "cover_image", payload.cover_image);
  if (payload.is_hidden !== undefined) appendFormValue(form, "is_hidden", payload.is_hidden);

  return apiRequest<ContentDetail>(
    `/api/content/poems/${id}/`,
    { method: "PATCH", body: form },
    true,
  );
}

export async function createStory(payload: TextContentPayload): Promise<ContentDetail> {
  return apiRequest<ContentDetail>(
    "/api/content/stories/",
    {
      method: "POST",
      body: buildTextContentBody(payload),
    },
    true,
  );
}

export async function updateStory(id: number, payload: Partial<TextContentPayload>): Promise<ContentDetail> {
  const form = new FormData();
  const sourceType = resolveTextSourceType(payload as TextContentPayload);
  if (payload.title !== undefined) appendFormValue(form, "title", payload.title);
  if (payload.description !== undefined) appendFormValue(form, "description", payload.description);
  appendFormValue(form, "source_type", sourceType);
  if (payload.is_anonymous !== undefined) appendFormValue(form, "is_anonymous", payload.is_anonymous);
  if (sourceType === "upload") {
    if (payload.upload_file) appendFormValue(form, "upload_file", payload.upload_file);
  } else {
    if (payload.body !== undefined) appendFormValue(form, "body", sanitizeEditableHtmlForTransport(payload.body));
  }
  if (payload.cover_image) appendFormValue(form, "cover_image", payload.cover_image);
  if (payload.is_hidden !== undefined) appendFormValue(form, "is_hidden", payload.is_hidden);

  return apiRequest<ContentDetail>(
    `/api/content/stories/${id}/`,
    { method: "PATCH", body: form },
    true,
  );
}

export async function deleteContentItem(category: "books" | "poems" | "stories", id: number): Promise<void> {
  await apiRequest(`/api/content/${category}/${id}/`, { method: "DELETE" }, true);
}

export async function restoreContentItem(category: "books" | "poems" | "stories", id: number): Promise<ContentDetail> {
  return apiRequest<ContentDetail>(`/api/content/${category}/${id}/restore/`, { method: "POST" }, true);
}

export async function hardDeleteContentItem(category: "books" | "poems" | "stories", id: number): Promise<void> {
  await apiRequest(`/api/content/${category}/${id}/hard-delete/`, { method: "DELETE" }, true);
}

export async function cleanupRecycleBin(category: "books" | "poems" | "stories"): Promise<{ deleted_count: number }> {
  return apiRequest<{ deleted_count: number }>(`/api/content/${category}/cleanup/`, { method: "POST" }, true);
}

export async function submitContentForReview(
  category: "books" | "poems" | "stories",
  id: number,
): Promise<ContentDetail> {
  return apiRequest<ContentDetail>(`/api/content/${category}/${id}/submit/`, { method: "POST" }, true);
}

export async function createChapter(payload: ChapterPayload) {
  return apiRequest(
    "/api/content/chapters/",
    {
      method: "POST",
      body: JSON.stringify({
        book: payload.book,
        title: payload.title || "",
        order: payload.order,
        body: sanitizeEditableHtmlForTransport(payload.body),
      }),
    },
    true,
  );
}

export async function updateChapter(id: number, payload: Partial<ChapterPayload>) {
  return apiRequest(
    `/api/content/chapters/${id}/`,
    {
      method: "PATCH",
      body: JSON.stringify({
        ...(payload.book !== undefined ? { book: payload.book } : {}),
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.order !== undefined ? { order: payload.order } : {}),
        ...(payload.body !== undefined ? { body: sanitizeEditableHtmlForTransport(payload.body) } : {}),
      }),
    },
    true,
  );
}

export async function deleteChapter(id: number): Promise<void> {
  await apiRequest(`/api/content/chapters/${id}/`, { method: "DELETE" }, true);
}

export async function submitChapterForReview(id: number): Promise<ContentDetail> {
  return apiRequest<ContentDetail>(`/api/content/chapters/${id}/submit/`, { method: "POST" }, true);
}

export async function fetchBookChapters(bookId: number, page = 1) {
  return fetchContent("chapters", {
    book: bookId,
    page,
    mine: true,
    requiresAuth: true,
  });
}

export async function reorderChapters(chapterIdsInOrder: number[]): Promise<void> {
  const tempStartOrder = 10_000;

  for (let i = 0; i < chapterIdsInOrder.length; i += 1) {
    await updateChapter(chapterIdsInOrder[i], { order: tempStartOrder + i });
  }

  for (let i = 0; i < chapterIdsInOrder.length; i += 1) {
    await updateChapter(chapterIdsInOrder[i], { order: i + 1 });
  }
}

export async function reviewContent(
  category: ContentCategory,
  id: number,
  status: "approved" | "rejected",
  rejectionReason = "",
): Promise<void> {
  await apiRequest(
    `/api/content/${category}/${id}/review/`,
    {
      method: "POST",
      body: JSON.stringify({ status, rejection_reason: rejectionReason }),
    },
    true,
  );
}


export async function fetchRedactors(): Promise<RedactorUser[]> {
  return apiRequest<RedactorUser[]>("/api/admin/redactors/", { method: "GET" }, true);
}

export async function createRedactor(payload: RedactorPayload): Promise<RedactorUser> {
  return apiRequest<RedactorUser>(
    "/api/admin/redactors/",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    true,
  );
}

export async function updateRedactor(id: number, payload: RedactorPayload): Promise<RedactorUser> {
  return apiRequest<RedactorUser>(
    `/api/admin/redactors/${id}/`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    true,
  );
}

export async function deleteRedactor(id: number): Promise<void> {
  await apiRequest(`/api/admin/redactors/${id}/`, { method: "DELETE" }, true);
}

export async function fetchNotifications(page = 1): Promise<PaginatedResponse<NotificationItem>> {
  const payload = await apiRequest<PaginatedResponse<NotificationItem> | NotificationItem[]>(
    `/api/notifications/${buildQueryString({ page })}`,
    { method: "GET" },
    true,
  );
  return asPaginated(payload);
}

export async function markNotificationRead(id: number, isRead = true): Promise<void> {
  if (isRead) {
    await markNotificationsRead({ ids: [id] });
    return;
  }
  await apiRequest(
    `/api/notifications/${id}/`,
    {
      method: "PATCH",
      body: JSON.stringify({ is_read: isRead }),
    },
    true,
  );
}

export async function markNotificationsRead(payload: { ids?: number[]; all?: boolean }): Promise<number> {
  const response = await apiRequest<{ updated: number }>(
    "/api/notifications/mark-read/",
    {
      method: "POST",
      body: JSON.stringify({
        ids: payload.ids || [],
        all: Boolean(payload.all),
      }),
    },
    true,
  );
  return Number(response.updated || 0);
}

export async function fetchNotificationUnreadCount(): Promise<number> {
  const payload = await apiRequest<{ unread_count: number }>(
    "/api/notifications/unread-count/",
    { method: "GET" },
    true,
  );
  return payload.unread_count || 0;
}

export async function fetchAuditLogs(params: {
  q?: string;
  actor?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
}): Promise<PaginatedResponse<AuditLogItem>> {
  const payload = await apiRequest<PaginatedResponse<AuditLogItem> | AuditLogItem[]>(
    `/api/admin/audit-logs/${buildQueryString(params)}`,
    { method: "GET" },
    true,
  );
  return asPaginated(payload);
}

export async function followAuthor(authorId: number): Promise<FollowState> {
  return apiRequest<FollowState>(
    `/api/authors/${authorId}/follow/`,
    { method: "POST" },
    true,
  );
}

export async function unfollowAuthor(authorId: number): Promise<FollowState> {
  return apiRequest<FollowState>(
    `/api/authors/${authorId}/follow/`,
    { method: "DELETE" },
    true,
  );
}

export async function fetchAuthorFollowState(authorId: number): Promise<FollowState> {
  return apiRequest<FollowState>(
    `/api/authors/${authorId}/follow-state/`,
    { method: "GET" },
    isAuthenticated(),
  );
}

export async function fetchMyFollowingAuthors(page = 1): Promise<PaginatedResponse<FollowingAuthorItem>> {
  const payload = await apiRequest<PaginatedResponse<FollowingAuthorItem> | FollowingAuthorItem[]>(
    `/api/me/following/${buildQueryString({ page })}`,
    { method: "GET" },
    true,
  );
  return asPaginated(payload);
}

export async function saveReadingProgress(payload: ReadingProgressUpsertPayload): Promise<ContinueReadingEntry> {
  return apiRequest<ContinueReadingEntry>(
    "/api/reading-progress/",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    true,
  );
}

export function saveReadingProgressKeepalive(payload: ReadingProgressUpsertPayload): void {
  const accessToken = getAccessToken();
  if (!accessToken) return;

  try {
    void fetch(`${API_BASE_URL}/api/reading-progress/`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Best-effort on unload.
  }
}

export async function fetchMyContinueReading(limit = 10): Promise<ContinueReadingEntry[]> {
  const payload = await apiRequest<{ results: ContinueReadingEntry[] }>(
    `/api/me/continue-reading/${buildQueryString({ limit })}`,
    { method: "GET" },
    true,
  );
  return payload.results || [];
}

export async function fetchContinueReading(page = 1): Promise<PaginatedResponse<ReadingProgressItem>> {
  const payload = await apiRequest<PaginatedResponse<ReadingProgressItem> | ReadingProgressItem[]>(
    `/api/engagement/progress/continue-reading/${buildQueryString({ page })}`,
    { method: "GET" },
    true,
  );
  return asPaginated(payload);
}

export async function fetchReadingProgress(
  category: ContentCategory,
  identifier: string | number,
): Promise<ReadingProgressItem | null> {
  const payload = await apiRequest<{ progress: ReadingProgressItem | null }>(
    `/api/engagement/content/${category}/${identifier}/progress/`,
    { method: "GET" },
    true,
  );
  return payload.progress;
}

export async function upsertReadingProgress(
  category: ContentCategory,
  identifier: string | number,
  payload: ReadingProgressPayload,
): Promise<ReadingProgressItem> {
  const response = await apiRequest<{ progress: ReadingProgressItem }>(
    `/api/engagement/content/${category}/${identifier}/progress/`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    true,
  );
  return response.progress;
}

export async function trackContentView(
  category: ContentCategory,
  identifier: string | number,
  paragraphIndex?: number,
): Promise<void> {
  await apiRequest(
    `/api/engagement/content/${category}/${identifier}/view/`,
    {
      method: "POST",
      body: JSON.stringify(
        paragraphIndex === undefined ? {} : { paragraph_index: paragraphIndex },
      ),
    },
    false,
  );
}

function categoryToTargetType(category: ContentCategory): EngagementTargetType {
  return category === "chapters" ? "chapter" : "work";
}

function categoryToWorkType(category: ContentCategory): WorkTypeFilter | undefined {
  if (category === "books" || category === "stories" || category === "poems") {
    return category;
  }
  return undefined;
}

export async function fetchLikeSummary(
  category: ContentCategory,
  identifier: string | number,
): Promise<ReactionSummary> {
  if (typeof identifier === "number") {
    const targetType = categoryToTargetType(category);
    if (targetType === "chapter") {
      return apiRequest<ReactionSummary>(
        `/api/chapters/${identifier}/like-state/`,
        { method: "GET" },
        isAuthenticated(),
      );
    }
    const workType = categoryToWorkType(category);
    return apiRequest<ReactionSummary>(
      `/api/works/${identifier}/like-state/${buildQueryString({ work_type: workType })}`,
      { method: "GET" },
      isAuthenticated(),
    );
  }
  return apiRequest<ReactionSummary>(
    `/api/engagement/content/${category}/${identifier}/like/`,
    { method: "GET" },
    false,
  );
}

export async function likeContent(
  category: ContentCategory,
  identifier: string | number,
): Promise<ReactionSummary> {
  if (typeof identifier === "number") {
    const targetType = categoryToTargetType(category);
    return apiRequest<ReactionSummary>(
      "/api/likes/",
      {
        method: "POST",
        body: JSON.stringify({
          target_type: targetType,
          target_id: identifier,
          work_type: targetType === "work" ? categoryToWorkType(category) : undefined,
        }),
      },
      true,
    );
  }
  return apiRequest<ReactionSummary>(
    `/api/engagement/content/${category}/${identifier}/like/`,
    { method: "POST" },
    true,
  );
}

export async function unlikeContent(
  category: ContentCategory,
  identifier: string | number,
): Promise<ReactionSummary> {
  if (typeof identifier === "number") {
    const targetType = categoryToTargetType(category);
    return apiRequest<ReactionSummary>(
      "/api/likes/",
      {
        method: "DELETE",
        body: JSON.stringify({
          target_type: targetType,
          target_id: identifier,
          work_type: targetType === "work" ? categoryToWorkType(category) : undefined,
        }),
      },
      true,
    );
  }
  return apiRequest<ReactionSummary>(
    `/api/engagement/content/${category}/${identifier}/like/`,
    { method: "DELETE" },
    true,
  );
}

export async function fetchAnchoredComments(
  targetType: EngagementTargetType,
  targetId: number,
  params: { workType?: WorkTypeFilter; page?: number } = {},
): Promise<PaginatedResponse<ContentCommentItem>> {
  const payload = await apiRequest<PaginatedResponse<ContentCommentItem> | ContentCommentItem[]>(
    `/api/comments/${buildQueryString({
      target_type: targetType,
      target_id: targetId,
      work_type: params.workType,
      page: params.page,
    })}`,
    { method: "GET" },
    false,
  );
  return asPaginated(payload);
}

export async function createAnchoredComment(payload: {
  targetType: EngagementTargetType;
  targetId: number;
  workType?: WorkTypeFilter;
  anchorType: "block" | "paragraph";
  anchorKey: string;
  body: string;
  parentComment?: number | null;
  paragraphIndex?: number | null;
}): Promise<ContentCommentItem> {
  return apiRequest<ContentCommentItem>(
    "/api/comments/",
    {
      method: "POST",
      body: JSON.stringify({
        target_type: payload.targetType,
        target_id: payload.targetId,
        work_type: payload.workType,
        anchor_type: payload.anchorType,
        anchor_key: payload.anchorKey,
        body: payload.body,
        parent_comment: payload.parentComment ?? undefined,
        paragraph_index: payload.paragraphIndex ?? undefined,
      }),
    },
    true,
  );
}

export async function hideComment(
  commentId: number,
  payload: { is_hidden: boolean; reason?: string },
): Promise<ContentCommentItem> {
  return apiRequest<ContentCommentItem>(
    `/api/comments/${commentId}/hide/`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    true,
  );
}

export async function deleteCommentById(commentId: number): Promise<void> {
  await apiRequest(`/api/comments/${commentId}/`, { method: "DELETE" }, true);
}

export async function fetchComments(
  category: ContentCategory,
  identifier: string | number,
  page = 1,
): Promise<PaginatedResponse<ContentCommentItem>> {
  const payload = await apiRequest<PaginatedResponse<ContentCommentItem> | ContentCommentItem[]>(
    `/api/engagement/content/${category}/${identifier}/comments/${buildQueryString({ page })}`,
    { method: "GET" },
    false,
  );
  return asPaginated(payload);
}

export async function createComment(
  category: ContentCategory,
  identifier: string | number,
  payload: { body: string; paragraph_index?: number | null; parent_id?: number | null },
): Promise<ContentCommentItem> {
  return apiRequest<ContentCommentItem>(
    `/api/engagement/content/${category}/${identifier}/comments/`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    true,
  );
}

export async function moderateComment(
  commentId: number,
  payload: { is_hidden: boolean; reason?: string },
): Promise<ContentCommentItem> {
  return apiRequest<ContentCommentItem>(
    `/api/engagement/comments/${commentId}/moderate/`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    true,
  );
}

export async function fetchTrending(
  range: "today" | "week" | "month" = "week",
  limit = 10,
  type?: "book" | "story" | "poem",
): Promise<TrendingItem[]> {
  const payload = await apiRequest<{
    range: string;
    results: Array<{
      work: TrendingItem;
      score: number;
      views: number;
      likes: number;
      comments: number;
      completions: number;
    }>;
  }>(
    `/api/discover/trending/${buildQueryString({ range, limit, type })}`,
    { method: "GET" },
    false,
  );
  return (payload.results || []).map((item) => ({
    ...item.work,
    score: item.score,
    views: item.views,
    likes: item.likes,
    comments: item.comments,
    unique_readers: 0,
  }));
}

export async function fetchRecommendations(limit = 10): Promise<RecommendationItem[]> {
  const payload = await apiRequest<{
    results: Array<{
      work: RecommendationItem;
      reason: string;
      score: number;
    }>;
  }>(
    `/api/discover/recommended/${buildQueryString({ limit })}`,
    { method: "GET" },
    true,
  );
  return (payload.results || []).map((item) => ({
    ...item.work,
    score: item.score,
    explain_reason: item.reason,
  }));
}

export async function fetchWriterAnalyticsOverview(
  range: "7d" | "30d" | "all" = "7d",
): Promise<WriterAnalyticsOverviewResponse> {
  return apiRequest<WriterAnalyticsOverviewResponse>(
    `/api/me/analytics/overview/${buildQueryString({ range })}`,
    { method: "GET" },
    true,
  );
}

export async function fetchWriterAnalyticsWorks(
  params: {
    range?: "7d" | "30d" | "all";
    sort?: "views" | "likes" | "comments" | "completions";
  } = {},
): Promise<WriterAnalyticsWorksResponse> {
  return apiRequest<WriterAnalyticsWorksResponse>(
    `/api/me/analytics/works/${buildQueryString({
      range: params.range || "7d",
      sort: params.sort || "views",
    })}`,
    { method: "GET" },
    true,
  );
}

export async function fetchWriterAnalyticsWorkDetail(
  workId: number,
  params: {
    range?: "7d" | "30d" | "all";
    work_type?: WorkTypeFilter;
  } = {},
): Promise<WriterAnalyticsWorkDetailResponse> {
  return apiRequest<WriterAnalyticsWorkDetailResponse>(
    `/api/me/analytics/works/${workId}/${buildQueryString({
      range: params.range || "7d",
      work_type: params.work_type,
    })}`,
    { method: "GET" },
    true,
  );
}

function toLegacyMetrics(snapshot: AnalyticsMetricSnapshot) {
  return {
    views: snapshot.views,
    unique_readers: snapshot.unique_readers,
    likes: snapshot.likes,
    comments: snapshot.comments,
    completion_estimate: snapshot.avg_progress,
    completion_rate: snapshot.completions,
  };
}

// Backward-compatible aggregate used by existing pages.
export async function fetchWriterAnalytics(range: "7d" | "30d" | "all" = "7d"): Promise<WriterAnalyticsResponse> {
  const [overview, works] = await Promise.all([
    fetchWriterAnalyticsOverview(range),
    fetchWriterAnalyticsWorks({ range, sort: "views" }),
  ]);

  return {
    range: overview.range,
    generated_at: overview.generated_at,
    totals: {
      views: overview.metrics.views,
      unique_readers: overview.metrics.unique_readers,
      likes: overview.metrics.likes,
      comments: overview.metrics.comments,
    },
    works: works.results.map((row) => ({
      ...row.work,
      metrics: toLegacyMetrics(row.metrics),
      chapters: row.chapters.map((chapterRow) => ({
        ...chapterRow.chapter,
        order: Number((chapterRow.chapter as { order?: number }).order || 0),
        metrics: toLegacyMetrics(chapterRow.metrics),
      })),
    })),
  };
}

export async function trackReferralVisit(params: { ref?: string; ref_code?: string }): Promise<boolean> {
  const payload = await apiRequest<{ tracked: boolean }>(
    "/api/referrals/visit/",
    {
      method: "POST",
      body: JSON.stringify({
        ref: params.ref,
        ref_code: params.ref_code,
      }),
    },
    false,
  );
  return Boolean(payload.tracked);
}

export function buildShareCardWorkUrl(workId: number): string {
  return `${API_BASE_URL}/api/share-card/work/${workId}.png`;
}

export function buildShareCardChapterUrl(chapterId: number): string {
  return `${API_BASE_URL}/api/share-card/chapter/${chapterId}.png`;
}

export function buildFacebookShareIntent(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

