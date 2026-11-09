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
