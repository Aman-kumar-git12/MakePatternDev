import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  srcDir: 'src',
  // Visible folder (macOS hides `.output`): load `dist/chrome-mv3` via "Load unpacked".
  outDir: 'dist',
  modules: ['@wxt-dev/module-react'],
  imports: false,
  // MV3 everywhere. WXT would build Firefox as MV2, where `browser.action` and MAIN-world
  // content scripts don't exist.
  manifestVersion: 3,
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: ({ browser }) => ({
    name: 'Coding Journey',
    description:
      'Upcoming contests, problems of the day, coding time, submission stats and code analysis for LeetCode, Codeforces, CodeChef, AtCoder, GFG and TUF.',
    // tabs: read the active tab's URL to attribute time to a platform/problem (time tracker).
    // unlimitedStorage: submissions with code and analyses can outgrow the 10 MB default quota.
    permissions: ['storage', 'unlimitedStorage', 'alarms', 'notifications', 'tabs', 'idle'],
    // Every host here is fetched by the background worker; see README "Privacy".
    host_permissions: [
      'https://codeforces.com/*',
      'https://leetcode.com/*',
      'https://www.codechef.com/*',
      'https://atcoder.jp/*',
      'https://kenkoooo.com/*',
      'https://practiceapi.geeksforgeeks.org/*',
      'https://authapi.geeksforgeeks.org/*',
      'https://takeuforward.org/*',
      // The local complexity agent (agent/ folder, `python app.py`); any port.
      'http://localhost/*',
      'http://127.0.0.1/*',
    ],
    action: { default_title: 'Coding Journey' },
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'coding-journey@makepattern',
              // MAIN-world content scripts (the LeetCode capture hook) need Firefox 128+.
              strict_min_version: '128.0',
              // The developer receives no data. The optional Claude review sends code straight
              // from the browser to Anthropic with the user's own key — review before AMO upload.
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : {}),
  }),
});
