export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export type QuestionStatus = 'Not Started' | 'In Progress' | 'Solved' | 'Needs Revision';

export type SupportedLanguage = 'python' | 'cpp' | 'java' | 'javascript';

export interface TestCase {
  id: string;
  question_id: string;
  title: string;
  input: string;
  expected_output: string;
  notes?: string;
  position: number;
  created_at?: string;
  updated_at?: string;
}

export interface Solution {
  id: string;
  question_id: string;
  title: string;
  solution_type?: string; // "Brute Force" | "Better Approach" | "Optimized Approach" | "Custom"
  language: SupportedLanguage;
  code: string;
  explanation?: string;
  time_complexity_estimate?: string;
  space_complexity_estimate?: string;
  manual_time_complexity?: string | null;
  manual_space_complexity?: string | null;
  time_complexity: string;
  space_complexity: string;
  analysis_explanation?: string;
  analysis_status?: 'Analyzing' | 'Completed' | 'Unable to Analyze' | 'Pending';
  analyzed_code_hash?: string;
  position: number;
  created_at?: string;
  updated_at?: string;
}

export interface ComplexityAnalysisResult {
  time_complexity: string;
  space_complexity: string;
  explanation: string;
  status: 'Analyzing' | 'Completed' | 'Unable to Analyze';
  code_hash: string;
}

export interface Question {
  id: string;
  user_id?: string;
  folder_id?: string | null;
  title: string;
  problem_url?: string;
  problem_statement: string;
  notes: string;
  difficulty: Difficulty;
  status: QuestionStatus;
  tags: string[];
  position: number;
  is_bookmarked?: boolean;
  folder_path?: string;
  solutions: Solution[];
  test_cases?: TestCase[];
  created_at?: string;
  updated_at?: string;
}

export interface QuestionListItem {
  id: string;
  folder_id?: string | null;
  title: string;
  problem_url?: string;
  difficulty: Difficulty;
  status: QuestionStatus;
  tags: string[];
  is_bookmarked?: boolean;
  folder_path?: string;
  position?: number;
  created_at?: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  user_id?: string;
  parent_id: string | null;
  name: string;
  description?: string;
  tags?: string[];
  position: number;
  question_count: number;
  solved_count: number;
  progress_percentage: number;
  subfolders: Folder[];
  questions: QuestionListItem[];
  created_at?: string;
  updated_at?: string;
}

export interface DifficultyBreakdown {
  total: number;
  solved: number;
}

export interface FolderProgressItem {
  folder_id: string;
  folder_name: string;
  total_questions: number;
  solved_questions: number;
  progress_percentage: number;
}

export interface ProgressSummary {
  total_topics?: number;
  total_subtopics?: number;
  total_questions: number;
  solved_questions: number;
  in_progress_questions: number;
  needs_revision_questions: number;
  not_started_questions: number;
  overall_percentage: number;
  difficulty_breakdown: Record<Difficulty, DifficultyBreakdown>;
  recent_questions: QuestionListItem[];
  continue_learning: QuestionListItem[];
  folder_overview: FolderProgressItem[];
}

export interface SearchResult {
  query: string;
  questions: Array<QuestionListItem & { folder_path: string }>;
  folders: Array<{ id: string; name: string; path: string; parent_id: string | null }>;
  total_results: number;
}

export type ViewMode = 'home' | 'patterns' | 'all-questions' | 'bookmarks' | 'progress' | 'workspace' | 'recent' | 'revision';

export interface User {
  id: string;
  email: string;
  full_name: string;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ShareResponse {
  share_id: string;
  folder_id: string;
  folder_name: string;
  is_active: boolean;
  share_url: string;
  created_at: string;
  updated_at: string;
}

export interface PublicSharedPatternResponse {
  share_id: string;
  owner_name: string;
  share_type?: 'single' | 'all';
  pattern?: Folder | null;
  patterns?: Folder[];
}
