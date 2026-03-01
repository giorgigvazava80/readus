import type {
  AuditLogItem,
  ContentCategory,
  ContentDetail,
  ContentItem,
  ContentStatus,
  MeUser,
  NotificationItem,
  PaginatedResponse,
  RedactorUser,
  RegisteredRole,
  WriterApplication,
  WriterApplicationStatus,
} from "@/lib/types";

const defaultApiUrl = typeof window !== 'undefined' ? `http://${window.location.hostname}:9000` : "http://localhost:9000";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || defaultApiUrl).replace(/\/$/, "");

export function resolveMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^(https?:|blob:|data:)/i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
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

export interface ContentListFilters {
  mine?: boolean;
  status?: ContentStatus;
  q?: string;
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

export async function updateProfile(payload: {
  first_name?: string;
  last_name?: string;
  username?: string;
}): Promise<void> {
  await apiRequest(
    "/auth/user/",
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

export async function fetchContentDetail(
  category: ContentCategory,
  id: number,
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
  await apiRequest(
    `/api/notifications/${id}/`,
    {
      method: "PATCH",
      body: JSON.stringify({ is_read: isRead }),
    },
    true,
  );
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

