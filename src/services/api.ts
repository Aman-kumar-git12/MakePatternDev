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
  PublicSharedPatternResponse
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

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (networkErr: unknown) {
      const isConnectionIssue = networkErr instanceof TypeError;
      const message = isConnectionIssue
        ? 'Server connection failed. Please ensure the backend server is running and accessible.'
        : (networkErr instanceof Error ? networkErr.message : 'Network error occurred');
      throw new ApiError(message, 0, null);
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
        if (!cleanErrorMessage || /not authenticated|unauthorized|invalid token/i.test(cleanErrorMessage)) {
          cleanErrorMessage = 'Invalid email or password. Please verify your credentials.';
        }
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
    tags: string[] = []
  ): Promise<Folder> {
    return this.request<Folder>('/folders/', {
      method: 'POST',
      body: JSON.stringify({ name, parent_id: parentId, description, tags }),
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
      body: JSON.stringify(updates),
    });
  }

  async moveFolder(folderId: string, targetParentId: string | null): Promise<void> {
    return this.request<void>(`/folders/${folderId}/move`, {
      method: 'POST',
      body: JSON.stringify({ target_parent_id: targetParentId }),
    });
  }

  async deleteFolder(folderId: string): Promise<void> {
    return this.request<void>(`/folders/${folderId}`, {
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
  }): Promise<Question> {
    return this.request<Question>('/questions/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateQuestion(id: string, updates: Partial<Question>): Promise<Question> {
    return this.request<Question>(`/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async reorderQuestions(items: Array<{ id: string; position: number }>): Promise<void> {
    return this.request<void>('/questions/reorder', {
      method: 'POST',
      body: JSON.stringify(items),
    });
  }

  async moveQuestion(questionId: string, targetFolderId: string): Promise<void> {
    return this.request<void>(`/questions/${questionId}/move`, {
      method: 'POST',
      body: JSON.stringify({ target_folder_id: targetFolderId }),
    });
  }

  async deleteQuestion(id: string): Promise<void> {
    return this.request<void>(`/questions/${id}`, {
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
    return this.request<ShareResponse>(`/folders/${folderId}/share`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    });
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

