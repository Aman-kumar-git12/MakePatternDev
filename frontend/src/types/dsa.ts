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
  leetcode_slug?: string | null;
  leetcode_id?: string | null;
  solved_at?: string | null;
  attempts?: number;
  time_spent_minutes?: number;
  next_review_at?: string | null;
  last_reviewed_at?: string | null;
  review_count?: number;
  review_interval_days?: number;
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
  leetcode_slug?: string | null;
  leetcode_id?: string | null;
  solved_at?: string | null;
  attempts?: number;
  time_spent_minutes?: number;
  next_review_at?: string | null;
  last_reviewed_at?: string | null;
  review_count?: number;
  review_interval_days?: number;
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
  current_streak?: number;
  longest_streak?: number;
  solved_this_week?: number;
  due_reviews?: number;
  total_time_minutes?: number;
  active_days?: number;
}

export interface SearchResult {
  query: string;
  questions: Array<QuestionListItem & { folder_path: string }>;
  folders: Array<{ id: string; name: string; path: string; parent_id: string | null }>;
  total_results: number;
}

export type ViewMode = 'home' | 'patterns' | 'all-questions' | 'bookmarks' | 'progress' | 'workspace' | 'recent' | 'revision' | 'settings' | 'trash' | 'extension';

export interface User {
  id: string;
  email: string;
  full_name: string;
  leetcode_username?: string | null;
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

// ---------------------------------------------------------------------------
// Spaced repetition
// ---------------------------------------------------------------------------
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface ReviewQueue {
  due: QuestionListItem[];
  upcoming: QuestionListItem[];
  due_count: number;
  reviewed_today: number;
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------
export interface ActivityDay {
  date: string; // YYYY-MM-DD
  count: number;
  solved: number;
  reviewed: number;
}

export interface ActivityResponse {
  days: ActivityDay[];
  current_streak: number;
  longest_streak: number;
  total_active_days: number;
}

// ---------------------------------------------------------------------------
// LeetCode
// ---------------------------------------------------------------------------
export interface LeetCodeSummary {
  slug: string;
  frontend_id: string;
  title: string;
  difficulty: Difficulty;
  tags: string[];
  url: string;
  acceptance_rate: number | null;
  is_paid_only: boolean;
}

export interface LeetCodeSearchItem extends LeetCodeSummary {
  already_tracked: boolean;
  question_id: string | null;
}

export interface LeetCodeExample {
  input: string;
  output: string;
  explanation: string;
}

export interface LeetCodeProblem extends LeetCodeSummary {
  statement_html: string;
  hints: string[];
  examples: LeetCodeExample[];
  already_tracked: boolean;
  question_id: string | null;
}

export interface LeetCodeDaily {
  date: string;
  problem: LeetCodeSummary;
  already_tracked: boolean;
  question_id: string | null;
}

export interface LeetCodeCounts {
  All: number;
  Easy: number;
  Medium: number;
  Hard: number;
}

export interface LeetCodeProfile {
  real_name: string | null;
  ranking: number | null;
  avatar: string | null;
  solved: LeetCodeCounts;
  total: LeetCodeCounts;
}

export interface LeetCodeSyncResult {
  username: string;
  profile: LeetCodeProfile;
  recent_accepted: Array<{ slug: string; title: string; timestamp: number | string }>;
  newly_solved: string[];
  imported: number;
  already_solved: number;
}

// ---------------------------------------------------------------------------
// Curricula & forking
// ---------------------------------------------------------------------------
export interface Curriculum {
  id: string;
  name: string;
  description: string;
  problem_count: number;
  patterns: string[];
}

export interface ImportedCollection {
  folder_id: string;
  folder_name: string;
  questions_imported: number;
}

// Code execution
export interface RunConfig {
  judge0_enabled: boolean;
  languages: SupportedLanguage[];
}

export interface Judge0Result {
  status: string;
  stdout: string;
  stderr: string;
  compile_output: string;
  time: string | number | null;
  memory: number | null;
}

// ---------------------------------------------------------------------------
// Trash / undo, bulk actions, JSON import
// ---------------------------------------------------------------------------

export type TrashKind = 'question' | 'folder' | 'bulk';

export interface TrashItem {
  id: string;
  kind: TrashKind;
  title: string;
  deleted_at: string;
  expires_at: string;
  question_count: number;
  folder_count: number;
}

export interface DeleteResult {
  message?: string;
  id?: string;
  deleted_folder_ids?: string[];
  trash_id: string;
}

export interface TrashRestoreResult {
  kind: TrashKind;
  restored_questions: number;
  restored_folders: number;
  folder_id: string | null;
  question_ids: string[];
}

export type BulkActionType =
  | 'move'
  | 'set_status'
  | 'set_difficulty'
  | 'add_tags'
  | 'remove_tags'
  | 'bookmark'
  | 'unbookmark'
  | 'delete';

export interface BulkActionRequest {
  question_ids: string[];
  action: BulkActionType;
  folder_id?: string | null;
  status?: QuestionStatus;
  difficulty?: Difficulty;
  tags?: string[];
}

export interface BulkActionResult {
  action: BulkActionType;
  updated: number;
  trash_id: string | null;
}

export interface DataImportResult {
  root_folder_id: string;
  root_folder_name: string;
  folders: number;
  questions: number;
  solutions: number;
  test_cases: number;
}
