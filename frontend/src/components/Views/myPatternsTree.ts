/** Pure helpers and types for MyPatternsView's tree (moved verbatim). */
import type { Folder, QuestionListItem } from '../../types/dsa';

export const EXPANDED_STORAGE_KEY = 'mp_mypatterns_expanded_nodes';

export interface DragState {
  type: 'root-folder' | 'subfolder' | 'question';
  id: string;
  folderId?: string | null; // For questions: folder_id
  parentId?: string | null; // For subfolders: parent folder ID
}

export interface DropTarget {
  type: 'root-folder' | 'subfolder' | 'question';
  id: string;
  position: 'before' | 'after' | 'into';
}

export type UnifiedChildItem =
  | { kind: 'subtopic'; id: string; position: number; data: Folder }
  | { kind: 'question'; id: string; position: number; data: QuestionListItem };

export const getUnifiedChildren = (
  subfolders: Folder[],
  questions: QuestionListItem[]
): UnifiedChildItem[] => {
  const sortedSubs = sortFolders(subfolders);
  const sortedQs = sortQuestions(questions);

  const list: UnifiedChildItem[] = [
    ...sortedSubs.map((s, idx) => ({
      kind: 'subtopic' as const,
      id: s.id,
      position: s.position !== undefined && s.position !== null ? s.position : idx,
      data: s,
    })),
    ...sortedQs.map((q, idx) => ({
      kind: 'question' as const,
      id: q.id,
      position: q.position !== undefined && q.position !== null ? q.position : sortedSubs.length + idx,
      data: q,
    })),
  ];

  return list.sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    if (a.kind !== b.kind) return a.kind === 'subtopic' ? -1 : 1;
    return 0;
  });
};

// First added shown first at top (position ASC, then created_at ASC)
export const sortFolders = (list: Folder[]): Folder[] => {
  return [...list].sort((a, b) => {
    const posA = a.position ?? 0;
    const posB = b.position ?? 0;
    if (posA !== posB) return posA - posB;
    if (a.created_at && b.created_at) {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    return 0;
  });
};

export const sortQuestions = (list: QuestionListItem[]): QuestionListItem[] => {
  return [...list].sort((a, b) => {
    const posA = a.position ?? 0;
    const posB = b.position ?? 0;
    if (posA !== posB) return posA - posB;
    if (a.created_at && b.created_at) {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    return 0;
  });
};

export const findFolder = (list: Folder[], id: string): Folder | null => {
  for (const f of list) {
    if (f.id === id) return f;
    if (f.subfolders && f.subfolders.length > 0) {
      const found = findFolder(f.subfolders, id);
      if (found) return found;
    }
  }
  return null;
};
