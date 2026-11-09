import type { Folder, QuestionListItem } from '../types/dsa';

/** Pure helpers for updating the folder tree on the client before the server confirms a change. */

export function findFolderNode(nodes: Folder[], id: string): Folder | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = node.subfolders?.length ? findFolderNode(node.subfolders, id) : null;
    if (hit) return hit;
  }
  return null;
}

/** True when `candidateId` is `folderId` itself or sits anywhere inside it. */
export function isSelfOrDescendant(nodes: Folder[], folderId: string, candidateId: string): boolean {
  const folder = findFolderNode(nodes, folderId);
  if (!folder) return false;
  return folder.id === candidateId || findFolderNode(folder.subfolders || [], candidateId) !== null;
}

/** Remove a folder (with everything inside it) from the tree. */
export function removeFolderNode(nodes: Folder[], id: string): { tree: Folder[]; removed: Folder | null } {
  let removed: Folder | null = null;
  const walk = (list: Folder[]): Folder[] =>
    list
      .filter((n) => {
        if (n.id === id) {
          removed = n;
          return false;
        }
        return true;
      })
      .map((n) => (n.subfolders?.length ? { ...n, subfolders: walk(n.subfolders) } : n));
  const tree = walk(nodes);
  return { tree, removed };
}

/** Insert a folder under `parentId` (null = top level). */
export function insertFolderNode(nodes: Folder[], parentId: string | null, folder: Folder): Folder[] {
  if (parentId === null) return [...nodes, folder];
  return nodes.map((n) => {
    if (n.id === parentId) return { ...n, subfolders: [...(n.subfolders || []), folder] };
    return n.subfolders?.length ? { ...n, subfolders: insertFolderNode(n.subfolders, parentId, folder) } : n;
  });
}

/**
 * Next free position among a parent's children. Subtopics and problems share one ordering inside a
 * topic, so both count. `parentId` null means the top-level topics.
 */
export function nextChildPosition(nodes: Folder[], questions: QuestionListItem[], parentId: string | null): number {
  const subfolders = parentId === null ? nodes : findFolderNode(nodes, parentId)?.subfolders || [];
  const positions = subfolders.map((f) => f.position ?? 0);
  if (parentId !== null) {
    for (const q of questions) if (q.folder_id === parentId) positions.push(q.position ?? 0);
  }
  return positions.length ? Math.max(...positions) + 1 : 0;
}

/** Recompute every folder's totals from the question list, exactly as the server builds the tree. */
export function recountTree(nodes: Folder[], questions: QuestionListItem[]): Folder[] {
  const byFolder = new Map<string, QuestionListItem[]>();
  for (const q of questions) {
    if (!q.folder_id) continue;
    const list = byFolder.get(q.folder_id);
    if (list) list.push(q);
    else byFolder.set(q.folder_id, [q]);
  }
  const walk = (list: Folder[]): Folder[] =>
    list.map((n) => {
      const subfolders = walk(n.subfolders || []);
      const own = byFolder.get(n.id) || [];
      const total = own.length + subfolders.reduce((sum, s) => sum + s.question_count, 0);
      const solved = own.filter((q) => q.status === 'Solved').length + subfolders.reduce((sum, s) => sum + s.solved_count, 0);
      return {
        ...n,
        subfolders,
        questions: own,
        question_count: total,
        solved_count: solved,
        progress_percentage: total ? Math.round((solved / total) * 1000) / 10 : 0,
      };
    });
  return walk(nodes);
}

/** "Topic / Subtopic" for a folder, built the same way as the server's folder_path. */
export function folderPathFor(nodes: Folder[], folderId: string | null | undefined): string {
  if (!folderId) return '';
  const names: string[] = [];
  let cur: Folder | null = findFolderNode(nodes, folderId);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    names.push(cur.name);
    cur = cur.parent_id ? findFolderNode(nodes, cur.parent_id) : null;
  }
  return names.reverse().join(' / ');
}

/**
 * A folder created on screen was saved: give it (and everything that points at it) the server id.
 * Children and problems added inside it meanwhile stay where they are.
 */
export function swapFolderId(
  nodes: Folder[],
  questions: QuestionListItem[],
  tempId: string,
  saved: Pick<Folder, 'id'> & Partial<Folder>
): { folders: Folder[]; questions: QuestionListItem[] } {
  const walk = (list: Folder[]): Folder[] =>
    list.map((n) => {
      const subfolders = n.subfolders?.length ? walk(n.subfolders) : n.subfolders;
      if (n.id === tempId) {
        return {
          ...n,
          id: saved.id,
          user_id: saved.user_id ?? n.user_id,
          created_at: saved.created_at ?? n.created_at,
          updated_at: saved.updated_at ?? n.updated_at,
          subfolders,
        };
      }
      if (n.parent_id === tempId) return { ...n, parent_id: saved.id, subfolders };
      return subfolders === n.subfolders ? n : { ...n, subfolders };
    });
  const nextQuestions = questions.map((q) => (q.folder_id === tempId ? { ...q, folder_id: saved.id } : q));
  return { folders: recountTree(walk(nodes), nextQuestions), questions: nextQuestions };
}
