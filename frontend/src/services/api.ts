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
  AuthResponse
} from '../types/dsa';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/+$/, '');

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

    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errorText = await res.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { detail: errorText || `HTTP ${res.status}` };
      }
      throw new Error(errorData.detail || errorData.message || 'API request failed');
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

  async getQuestion(id: string): Promise<Question> {
    return this.request<Question>(`/questions/${id}`);
  }

  async createQuestion(data: {
    folder_id: string;
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
}

export const api = new ApiService();
