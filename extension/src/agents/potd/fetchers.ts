import { fetchJson, leetcodeGraphql } from '../../lib/http';
import type { Potd } from '../../lib/types';

/** LeetCode's own daily-challenge link — opening it this way counts towards LeetCode's daily streak. */
export function leetcodeDailyUrl(slug: string, date: string): string {
  return `https://leetcode.com/problems/${slug}/description/?envType=daily-question&envId=${date}`;
}

export const GFG_POTD_URL = 'https://www.geeksforgeeks.org/problem-of-the-day';

export async function fetchLeetCodePotd(): Promise<Potd> {
  const data = await leetcodeGraphql<{
    activeDailyCodingChallengeQuestion: {
      date: string;
      link: string;
      question: {
        title: string;
        titleSlug: string;
        difficulty: string;
        questionFrontendId: string;
        topicTags: { name: string }[];
      };
    };
  }>(
    '{ activeDailyCodingChallengeQuestion { date link question { title titleSlug difficulty questionFrontendId topicTags { name } } } }',
  );
  const d = data.activeDailyCodingChallengeQuestion;
  return {
    source: 'leetcode',
    platform: 'leetcode',
    key: `leetcode:${d.question.titleSlug}`,
    title: `${d.question.questionFrontendId}. ${d.question.title}`,
    url: leetcodeDailyUrl(d.question.titleSlug, d.date),
    difficulty: d.question.difficulty,
    tags: d.question.topicTags.map((t) => t.name),
    date: d.date,
  };
}

export async function fetchGfgPotd(): Promise<Potd> {
  const d = await fetchJson<{
    date: string;
    problem_name: string;
    problem_url: string;
    difficulty: string;
    tags?: { topic_tags?: string[] };
    accuracy?: number;
  }>('https://practiceapi.geeksforgeeks.org/api/vr/problems-of-day/problem/today/');
  if (!d.problem_url) throw new Error('GFG: no problem in response');
  const slug = d.problem_url.match(/\/problems\/([^/]+)/)?.[1]?.toLowerCase() ?? d.problem_url;
  return {
    source: 'gfg',
    platform: 'gfg',
    key: `gfg:${slug}`,
    title: d.problem_name,
    url: d.problem_url.split('?')[0]!,
    extraUrl: GFG_POTD_URL,
    difficulty: d.difficulty,
    tags: d.tags?.topic_tags ?? [],
    date: d.date.slice(0, 10),
    note: d.accuracy ? `${d.accuracy.toFixed(0)}% accuracy` : undefined,
  };
}
