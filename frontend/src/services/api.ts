import type { Preferences } from '../context/preferencesCore';
import { resolveTempIds } from '../app/pendingIds';
import type {
  Folder,
  Question,
  QuestionListItem,
  Solution,
  TestCase,
  ProgressSummary,
  SearchResult,
  Difficulty,
  QuestionStatus,
  SupportedLanguage,
  ComplexityAnalysisResult,
  User,
  AuthResponse,
  ShareResponse,
  PublicSharedPatternResponse,
  ReviewQueue,
  ReviewRating,
  ActivityResponse,
  LeetCodeProblem,
  LeetCodeDaily,
  LeetCodeSearchItem,
  LeetCodeSyncResult,
  LeetCodeProfile,
  Curriculum,
  ImportedCollection,
  RunConfig,
  Judge0Result,
  TrashItem,
  TrashRestoreResult,
  DeleteResult,
  BulkActionRequest,
  BulkActionResult,
  DataImportResult,
} from '../types/dsa';

let rawBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')
    ? 'https://makepatternbakend.onrender.com/api'
    : 'http://localhost:8000/api')
).replace(/\/+$/, '');

if (!rawBaseUrl.endsWith('/api')) {
  rawBaseUrl += '/api';
}

const API_BASE_URL = rawBaseUrl;

/** IANA timezone of the browser, sent with every request so streaks/"today" match the user's day. */
const getTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

/** Result of POST /reviews/batch. Every status other than "applied" is also final for the client. */
export interface ReviewBatchResult {
  applied: number;
  skipped: number;
  results: { client_id: string; status: 'applied' | 'duplicate' | 'not_found' | 'stale' }[];
}

/** True when a request never reached the server (offline, DNS, CORS/connection reset). */
export function isNetworkError(err: unknown): boolean {
  return err instanceof ApiError ? err.status === 0 : err instanceof TypeError;
}

/**
 * The backend treats a missing/null field as "unchanged" and "" as "clear". Callers naturally
 * write `null` to mean "clear", so translate it for the fields where clearing is meaningful.
 */
function nullMeansClear<T extends Record<string, unknown>>(updates: T, fields: string[]): T {
  const out: Record<string, unknown> = { ...updates };
  for (const f of fields) if (f in out && out[f] === null) out[f] = '';
  return out as T;
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  fieldErrors: Record<string, string>;

  constructor(message: string, status: number = 0, data?: unknown, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.fieldErrors = fieldErrors;
  }
}

class ApiService {
  private token: string | null = null;
  private unauthorizedHandler: (() => void) | null = null;

  /** Called when an authenticated request comes back 401 (expired or revoked token). */
  onUnauthorized(handler: (() => void) | null) {
    this.unauthorizedHandler = handler;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  clearToken() {
    this.token = null;
  }

  // Auth API
  async login(email: string, password: string): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.access_token) {
      this.setToken(data.access_token);
    }
    return data;
  }

  async register(email: string, password: string, fullName: string): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name: fullName }),
    });
    if (data.access_token) {
      this.setToken(data.access_token);
    }
    return data;
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Timezone': getTimezone(),
      ...(extra || {}),
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  /**
   * Fire-and-forget PUT that survives page unload (fetch keepalive). Used to flush
   * pending autosaves on tab close / navigation. Body must stay under ~64KB.
   */
  flushKeepalive(endpoint: string, body: unknown): void {
    try {
      const payload = JSON.stringify(body);
      fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'PUT',
        headers: this.buildHeaders(),
        body: payload,
        keepalive: payload.length < 60000,
      }).catch(() => {});
    } catch {
      // best effort
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Something created a moment ago may still be saving: wait for it and use its real id.
    if (endpoint.includes('mptmp-') || (typeof options.body === 'string' && options.body.includes('mptmp-'))) {
      try {
        endpoint = await resolveTempIds(endpoint);
        if (typeof options.body === 'string') options = { ...options, body: await resolveTempIds(options.body) };
      } catch (err: unknown) {
        throw new ApiError(err instanceof Error ? err.message : 'Item not saved', 424, null);
      }
    }
    const headers = this.buildHeaders(options.headers as Record<string, string> | undefined);
    const sentToken = this.token;
    const method = (options.method || 'GET').toUpperCase();
    // Only retry requests that are safe to repeat: a POST may already have been applied.
    const retryable = method === 'GET' || method === 'HEAD' || method === 'PUT';

    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (networkErr: unknown) {
      // If transient connection issue occurred (e.g. backend reloaded/restarting), retry once after a short delay
      if (networkErr instanceof TypeError && retryable) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 500));
          res = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
          });
        } catch {
          throw new ApiError(
            'Server connection failed. Please ensure the backend server is running and accessible.',
            0,
            null
          );
        }
      } else if (networkErr instanceof TypeError) {
        throw new ApiError(
          'Server connection failed. Please check your connection and try again.',
          0,
          null
        );
      } else {
        const message = networkErr instanceof Error ? networkErr.message : 'Network error occurred';
        throw new ApiError(message, 0, null);
      }
    }

    if (!res.ok) {
      const errorText = await res.text();
      let errorData: any = null;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { detail: errorText || `HTTP ${res.status}` };
      }

      const fieldErrors: Record<string, string> = {};
      let cleanErrorMessage = '';

      // 1. Handle FastAPI / Pydantic validation errors (array of errors in detail)
      if (Array.isArray(errorData?.detail)) {
        const errorList: string[] = [];
        for (const item of errorData.detail) {
          const rawField = Array.isArray(item.loc) && item.loc.length > 0
            ? String(item.loc[item.loc.length - 1])
            : 'field';

          let itemMsg = String(item.msg || 'Invalid value');
          if (itemMsg.startsWith('Value error, ')) {
            itemMsg = itemMsg.replace('Value error, ', '');
          }

          const readableField = rawField
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());

          if (item.type === 'missing' || itemMsg.toLowerCase().includes('field required')) {
            const desc = `${readableField} is missing`;
            fieldErrors[rawField] = desc;
            errorList.push(desc);
          } else {
            const desc = `${readableField}: ${itemMsg}`;
            fieldErrors[rawField] = itemMsg;
            errorList.push(desc);
          }
        }
        cleanErrorMessage = errorList.join('. ');
      } else if (typeof errorData?.detail === 'string') {
        cleanErrorMessage = errorData.detail;
      } else if (typeof errorData?.message === 'string') {
        cleanErrorMessage = errorData.message;
      }

      // 2. Status-specific semantic enhancements
      if (res.status === 400) {
        if (/already registered|already in use|duplicate/i.test(cleanErrorMessage)) {
          cleanErrorMessage = 'This email address is already registered. Please sign in or use a different email.';
          fieldErrors.email = 'Email already in use';
        } else if (!cleanErrorMessage) {
          cleanErrorMessage = 'Invalid request. Please check all provided information.';
        }
      } else if (res.status === 401) {
        if (/^\/auth\/(login|register)/.test(endpoint)) {
          if (!cleanErrorMessage || /not authenticated|unauthorized|invalid token/i.test(cleanErrorMessage)) {
            cleanErrorMessage = 'Invalid email or password. Please verify your credentials.';
          }
        } else if (!cleanErrorMessage || /not authenticated|unauthorized|invalid token|expired|credentials/i.test(cleanErrorMessage)) {
          cleanErrorMessage = 'Your session has expired. Please sign in again.';
        }
      } else if (res.status === 429) {
        cleanErrorMessage = cleanErrorMessage || 'Too many attempts. Please wait a minute and try again.';
      } else if (res.status === 403) {
        cleanErrorMessage = cleanErrorMessage || 'Access forbidden: You do not have permission for this action.';
      } else if (res.status === 404) {
        cleanErrorMessage = cleanErrorMessage || 'The requested resource was not found (404).';
      } else if (res.status === 422) {
        if (!cleanErrorMessage) {
          cleanErrorMessage = 'Validation error: One or more fields are invalid or missing.';
        }
      } else if (res.status >= 500) {
        cleanErrorMessage = `Server error (${res.status}): The backend encountered an unexpected error. Please check your backend logs or try again.`;
      } else if (!cleanErrorMessage) {
        cleanErrorMessage = `Request failed with HTTP status ${res.status}`;
      }

      // An authenticated request rejected with 401 means the session expired or was revoked.
      // Password checks (change password, delete account) are not session failures, and a 401 for a
      // token that has since been replaced (e.g. after a password change) must not sign out the new one.
      const passwordCheck = endpoint.startsWith('/auth/change-password') || endpoint.startsWith('/auth/delete-account');
      if (
        res.status === 401 &&
        sentToken &&
        sentToken === this.token &&
        !endpoint.startsWith('/auth/login') &&
        !passwordCheck &&
        this.unauthorizedHandler
      ) {
        this.unauthorizedHandler();
      }

      throw new ApiError(cleanErrorMessage, res.status, errorData, fieldErrors);
    }

    const text = await res.text();
    if (!text) return {} as T;
    try {
      return JSON.parse(text);
    } catch {
      return text as unknown as T;
    }
  }

  // Folders / Topics API
  async getFolderTree(): Promise<Folder[]> {
    return this.request<Folder[]>('/folders/tree');
  }

  async createFolder(
    name: string,
    parentId: string | null = null,
    description: string = '',
    tags: string[] = [],
    position?: number
  ): Promise<Folder> {
    return this.request<Folder>('/folders/', {
      method: 'POST',
      body: JSON.stringify({ name, parent_id: parentId, description, tags, ...(position !== undefined ? { position } : {}) }),
    });
  }

  async updateFolder(
    folderId: string,
    updates: {
      name?: string;
      description?: string;
      tags?: string[];
      parent_id?: string | null;
      position?: number;
    }
  ): Promise<Folder> {
    return this.request<Folder>(`/folders/${folderId}`, {
      method: 'PUT',
      body: JSON.stringify(nullMeansClear(updates, ['parent_id'])),
    });
  }

  /** `newPosition` pins the folder's place among its new siblings; omitted, the server appends it. */
  async moveFolder(folderId: string, targetParentId: string | null, newPosition?: number): Promise<void> {
    return this.request<void>(`/folders/${folderId}/move`, {
      method: 'POST',
      body: JSON.stringify({ target_parent_id: targetParentId, ...(newPosition !== undefined ? { new_position: newPosition } : {}) }),
    });
  }

  /** Soft delete: the folder (and its contents) goes to the trash; `trash_id` restores it. */
  async deleteFolder(folderId: string): Promise<DeleteResult> {
    return this.request<DeleteResult>(`/folders/${folderId}`, {
      method: 'DELETE',
    });
  }

  async reorderFolders(items: Array<{ id: string; position: number }>): Promise<void> {
    return this.request<void>('/folders/reorder', {
      method: 'POST',
      body: JSON.stringify(items),
    });
  }

  // Questions API
  async listQuestions(params?: { folder_id?: string; difficulty?: string; status?: string; search?: string }): Promise<QuestionListItem[]> {
    const query = new URLSearchParams();
    if (params?.folder_id) query.append('folder_id', params.folder_id);
    if (params?.difficulty) query.append('difficulty', params.difficulty);
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<QuestionListItem[]>(`/questions/${qs}`);
  }

  async getRandomQuestions(params?: { count?: number; only_revision?: boolean; pool?: string; status?: string; difficulty?: string }): Promise<QuestionListItem[]> {
    const query = new URLSearchParams();
    if (params?.count) query.append('count', params.count.toString());
    if (params?.pool) query.append('pool', params.pool);
    if (params?.only_revision !== undefined) query.append('only_revision', params.only_revision ? 'true' : 'false');
    if (params?.status) query.append('status', params.status);
    if (params?.difficulty) query.append('difficulty', params.difficulty);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<QuestionListItem[]>(`/questions/random${qs}`);
  }

  async getQuestion(id: string): Promise<Question> {
    return this.request<Question>(`/questions/${id}`);
  }

  async createQuestion(data: {
    folder_id?: string | null;
    title: string;
    problem_url?: string;
    difficulty?: Difficulty;
    status?: QuestionStatus;
    tags?: string[];
    problem_statement?: string;
    notes?: string;
    position?: number;
  }): Promise<Question> {
    return this.request<Question>('/questions/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateQuestion(id: string, updates: Partial<Question>): Promise<Question> {
    return this.request<Question>(`/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(nullMeansClear(updates as Record<string, unknown>, ['folder_id'])),
    });
  }

  async reorderQuestions(items: Array<{ id: string; position: number }>): Promise<void> {
    return this.request<void>('/questions/reorder', {
      method: 'POST',
      body: JSON.stringify(items),
    });
  }

  /** `newPosition` pins the question's place in the target folder; omitted, the server appends it. */
  async moveQuestion(questionId: string, targetFolderId: string | null, newPosition?: number): Promise<void> {
    return this.request<void>(`/questions/${questionId}/move`, {
      method: 'POST',
      body: JSON.stringify({ target_folder_id: targetFolderId, ...(newPosition !== undefined ? { new_position: newPosition } : {}) }),
    });
  }

  /** Soft delete: the question goes to the trash; `trash_id` restores it. */
  async deleteQuestion(id: string): Promise<DeleteResult> {
    return this.request<DeleteResult>(`/questions/${id}`, {
      method: 'DELETE',
    });
  }

  // Solutions API
  async createSolution(questionId: string, solution: {
    title?: string;
    solution_type?: string;
    language?: SupportedLanguage;
    code?: string;
    explanation?: string;
    time_complexity?: string;
    space_complexity?: string;
    manual_time_complexity?: string;
    manual_space_complexity?: string;
  }): Promise<Solution> {
    return this.request<Solution>(`/solutions/question/${questionId}`, {
      method: 'POST',
      body: JSON.stringify(solution),
    });
  }

  async updateSolution(solutionId: string, updates: Partial<Solution>): Promise<Solution> {
    return this.request<Solution>(`/solutions/${solutionId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteSolution(solutionId: string): Promise<void> {
    return this.request<void>(`/solutions/${solutionId}`, {
      method: 'DELETE',
    });
  }

  async triggerSolutionAnalysis(solutionId: string): Promise<Solution> {
    return this.request<Solution>(`/solutions/${solutionId}/analyze`, {
      method: 'POST',
    });
  }

  async analyzeComplexity(code: string, language: SupportedLanguage = 'python'): Promise<ComplexityAnalysisResult> {
    return this.request<ComplexityAnalysisResult>('/solutions/analyze-complexity', {
      method: 'POST',
      body: JSON.stringify({ code, language }),
    });
  }

  // Test Cases API
  async getTestCases(questionId: string): Promise<TestCase[]> {
    return this.request<TestCase[]>(`/test-cases/question/${questionId}`);
  }

  async createTestCase(questionId: string, testCase: {
    title?: string;
    input?: string;
    expected_output?: string;
    notes?: string;
    position?: number;
  }): Promise<TestCase> {
    return this.request<TestCase>(`/test-cases/question/${questionId}`, {
      method: 'POST',
      body: JSON.stringify(testCase),
    });
  }

  async updateTestCase(testCaseId: string, updates: Partial<TestCase>): Promise<TestCase> {
    return this.request<TestCase>(`/test-cases/${testCaseId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteTestCase(testCaseId: string): Promise<void> {
    return this.request<void>(`/test-cases/${testCaseId}`, {
      method: 'DELETE',
    });
  }

  // Bookmarks API
  async getBookmarks(): Promise<Array<{ id: string; question: Question }>> {
    return this.request<Array<{ id: string; question: Question }>>('/bookmarks/');
  }

  async toggleBookmark(questionId: string): Promise<{ is_bookmarked: boolean; message: string }> {
    return this.request<{ is_bookmarked: boolean; message: string }>(`/bookmarks/${questionId}/toggle`, {
      method: 'POST',
    });
  }

  // Progress API
  async getProgressSummary(): Promise<ProgressSummary> {
    return this.request<ProgressSummary>('/progress/summary');
  }

  // Search API
  async search(query: string): Promise<SearchResult> {
    return this.request<SearchResult>(`/search/?q=${encodeURIComponent(query)}`);
  }

  // Sharing API
  async getFolderShare(folderId: string): Promise<ShareResponse> {
    return this.request<ShareResponse>(`/folders/${folderId}/share`);
  }

  async createFolderShare(folderId: string): Promise<ShareResponse> {
    return this.request<ShareResponse>(`/folders/${folderId}/share`, {
      method: 'POST',
    });
  }

  async updateFolderShare(folderId: string, isActive: boolean): Promise<ShareResponse> {
    try {
      return await this.request<ShareResponse>(`/folders/${folderId}/share`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: isActive }),
      });
    } catch (err: unknown) {
      if (err instanceof ApiError && (err.status === 405 || err.status === 0)) {
        return this.request<ShareResponse>(`/folders/${folderId}/share`, {
          method: 'PUT',
          body: JSON.stringify({ is_active: isActive }),
        });
      }
      throw err;
    }
  }

  async revokeFolderShare(folderId: string): Promise<ShareResponse> {
    return this.request<ShareResponse>(`/folders/${folderId}/share/revoke`, {
      method: 'POST',
    });
  }

  // Public Shared API
  async getSharedPattern(shareId: string): Promise<PublicSharedPatternResponse> {
    return this.request<PublicSharedPatternResponse>(`/shared/${shareId}`);
  }

  async getSharedQuestion(shareId: string, questionId: string): Promise<Question> {
    return this.request<Question>(`/shared/${shareId}/questions/${questionId}`);
  }

  // Attempts / time tracking
  async logAttempt(questionId: string, minutes: number, solved?: boolean): Promise<Question> {
    return this.request<Question>(`/questions/${questionId}/attempt`, {
      method: 'POST',
      body: JSON.stringify({ minutes: Math.max(0, Math.min(600, Math.round(minutes))), solved }),
    });
  }

  // Spaced repetition
  async getDueReviews(): Promise<ReviewQueue> {
    return this.request<ReviewQueue>('/reviews/due');
  }

  async submitReview(questionId: string, rating: ReviewRating): Promise<QuestionListItem> {
    return this.request<QuestionListItem>(`/reviews/${questionId}`, {
      method: 'POST',
      body: JSON.stringify({ rating }),
    });
  }

  /** Flush reviews made offline. Idempotent per client_id on the server. */
  async submitReviewBatch(
    reviews: { client_id: string; question_id: string; rating: ReviewRating; reviewed_at: string }[]
  ): Promise<ReviewBatchResult> {
    return this.request<ReviewBatchResult>('/reviews/batch', {
      method: 'POST',
      body: JSON.stringify({ reviews }),
    });
  }

  // Activity heatmap & streaks
  async getActivity(days: number = 365): Promise<ActivityResponse> {
    return this.request<ActivityResponse>(`/progress/activity?days=${days}`);
  }

  // LeetCode
  async getLeetCodeProblem(q: string): Promise<LeetCodeProblem> {
    return this.request<LeetCodeProblem>(`/leetcode/problem?q=${encodeURIComponent(q)}`);
  }

  async importLeetCode(q: string, folderId?: string | null, status?: QuestionStatus): Promise<Question> {
    return this.request<Question>('/leetcode/import', {
      method: 'POST',
      body: JSON.stringify({ q, folder_id: folderId || null, ...(status ? { status } : {}) }),
    });
  }

  async refreshFromLeetCode(questionId: string): Promise<Question> {
    return this.request<Question>(`/leetcode/refresh/${questionId}`, { method: 'POST' });
  }

  async getLeetCodeDaily(): Promise<LeetCodeDaily> {
    return this.request<LeetCodeDaily>('/leetcode/daily');
  }

  async searchLeetCode(q: string, limit: number = 10): Promise<LeetCodeSearchItem[]> {
    return this.request<LeetCodeSearchItem[]>(`/leetcode/search?q=${encodeURIComponent(q)}&limit=${limit}`);
  }

  async syncLeetCode(params: { username?: string; import_missing?: boolean; folder_id?: string | null }): Promise<LeetCodeSyncResult> {
    return this.request<LeetCodeSyncResult>('/leetcode/sync', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getLeetCodeProfile(username: string): Promise<LeetCodeProfile> {
    return this.request<LeetCodeProfile>(`/leetcode/profile/${encodeURIComponent(username)}`);
  }

  // Curricula
  async getCurricula(): Promise<Curriculum[]> {
    return this.request<Curriculum[]>('/curricula');
  }

  async importCurriculum(id: string): Promise<ImportedCollection> {
    return this.request<ImportedCollection>(`/curricula/${encodeURIComponent(id)}/import`, { method: 'POST' });
  }

  // Fork a shared pattern into my workspace
  async forkSharedPattern(shareId: string): Promise<ImportedCollection> {
    return this.request<ImportedCollection>(`/shared/${encodeURIComponent(shareId)}/fork`, { method: 'POST' });
  }

  // Account
  async updateMe(updates: { full_name?: string; leetcode_username?: string | null }): Promise<User> {
    return this.request<User>('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(nullMeansClear(updates, ['leetcode_username'])),
    });
  }

  /** Display/accessibility preferences (theme, editor, focus mode, shortcuts). */
  async getPreferences(): Promise<Preferences> {
    return this.request<Preferences>('/auth/preferences');
  }

  async updatePreferences(updates: Partial<Preferences>): Promise<Preferences> {
    return this.request<Preferences>('/auth/preferences', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string; access_token: string }> {
    const res = await this.request<{ message: string; access_token: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    if (res.access_token) this.setToken(res.access_token);
    return res;
  }

  async logoutAll(): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/logout-all', { method: 'POST' });
  }

  async deleteAccount(password: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/delete-account', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  /** Downloads the full account export as a JSON file. */
  async downloadExport(): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/auth/export`, { headers: this.buildHeaders() });
    if (!res.ok) {
      throw new ApiError(`Export failed (HTTP ${res.status})`, res.status);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `makepattern-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Code execution (Python/JS run in the browser; Judge0 is optional on the server)
  async getRunConfig(): Promise<RunConfig> {
    return this.request<RunConfig>('/run/config');
  }

  async runJudge0(language: SupportedLanguage, code: string, stdin: string): Promise<Judge0Result> {
    return this.request<Judge0Result>('/run/judge0', {
      method: 'POST',
      body: JSON.stringify({ language, code, stdin }),
    });
  }

  // Bulk actions on many questions at once
  async bulkQuestions(body: BulkActionRequest): Promise<BulkActionResult> {
    return this.request<BulkActionResult>('/questions/bulk', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // Trash (soft-deleted items, purged after 30 days)
  async listTrash(): Promise<TrashItem[]> {
    return this.request<TrashItem[]>('/trash');
  }

  async restoreTrashItem(trashId: string): Promise<TrashRestoreResult> {
    return this.request<TrashRestoreResult>(`/trash/${trashId}/restore`, { method: 'POST' });
  }

  async deleteTrashItem(trashId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/trash/${trashId}`, { method: 'DELETE' });
  }

  async emptyTrash(): Promise<{ deleted: number }> {
    return this.request<{ deleted: number }>('/trash', { method: 'DELETE' });
  }

  /** Restore a JSON backup produced by downloadExport (imported under a new root folder). */
  async importData(payload: unknown): Promise<DataImportResult> {
    return this.request<DataImportResult>('/auth/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Pre-warm background backend to eliminate cold-start lag
  async warmup(): Promise<void> {
    try {
      fetch(`${API_BASE_URL}/health`, { method: 'GET' }).catch(() => {});
    } catch {
      // ignore
    }
  }
}

export const api = new ApiService();

