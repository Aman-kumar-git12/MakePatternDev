import React from 'react';
import { Palette, RotateCcw, Keyboard } from 'lucide-react';
import { usePreferences } from '../../context/usePreferences';
import type {
  EditorThemePreference,
  FontFamilyPreference,
  ThemePreference,
  UiScale,
} from '../../context/preferencesCore';
import { resolveEditorTheme } from '../../context/preferencesCore';

interface OptionGroupProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}

function OptionGroup<T extends string>({ label, value, options, onChange }: OptionGroupProps<T>) {
  const name = `mp-pref-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-semibold mp-muted">{label}</legend>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <label
              key={o.value}
              className={`mp-chip cursor-pointer select-none px-3 py-1.5 text-xs ${selected ? 'mp-btn-primary' : ''}`}
              style={selected ? undefined : { color: 'var(--text-secondary)' }}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={selected}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

const Toggle: React.FC<{ label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }> = ({
  label,
  hint,
  checked,
  onChange,
}) => (
  <label className="flex items-start justify-between gap-3 cursor-pointer py-1">
    <span>
      <span className="block text-sm" style={{ color: 'var(--text-primary)' }}>{label}</span>
      {hint && <span className="block text-xs mp-faint">{hint}</span>}
    </span>
    <span className="relative inline-flex shrink-0 mt-0.5">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className="w-9 h-5 rounded-full border transition-colors peer-focus-visible:outline peer-focus-visible:outline-2"
        style={{
          backgroundColor: checked ? 'var(--accent-primary)' : 'var(--bg-surface)',
          borderColor: checked ? 'var(--accent-primary)' : 'var(--border-primary)',
          outlineColor: 'var(--accent-primary)',
        }}
      />
      <span
        aria-hidden="true"
        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform"
        style={{
          backgroundColor: checked ? '#18181b' : 'var(--text-muted)',
          transform: checked ? 'translateX(16px)' : 'translateX(0)',
        }}
      />
    </span>
  </label>
);

const EDITOR_PREVIEW: Record<string, { bg: string; fg: string; kw: string; num: string; cm: string }> = {
  'vs-dark': { bg: '#1e1e1e', fg: '#d4d4d4', kw: '#569cd6', num: '#b5cea8', cm: '#6a9955' },
  light: { bg: '#ffffff', fg: '#000000', kw: '#0000ff', num: '#098658', cm: '#008000' },
  vs: { bg: '#ffffff', fg: '#000000', kw: '#0000ff', num: '#098658', cm: '#008000' },
  'hc-black': { bg: '#000000', fg: '#ffffff', kw: '#569cd6', num: '#b5cea8', cm: '#7ca668' },
  'hc-light': { bg: '#ffffff', fg: '#292929', kw: '#0f4a85', num: '#096d48', cm: '#515151' },
};

/** Settings → Appearance & accessibility. Changes apply instantly and sync to the account. */
export const AppearancePanel: React.FC = () => {
  const { prefs, setPrefs, resetPrefs, isDark } = usePreferences();
  const editorTheme = resolveEditorTheme(prefs, isDark);
  const ed = EDITOR_PREVIEW[editorTheme] ?? EDITOR_PREVIEW['vs-dark'];

  return (
    <section className="mp-card p-4 sm:p-5 space-y-4" aria-labelledby="mp-appearance-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="mp-appearance-title" className="text-sm font-bold flex items-center gap-2">
          <Palette className="w-4 h-4" aria-hidden="true" />
          Appearance &amp; accessibility
        </h2>
        <button type="button" className="mp-btn text-xs" onClick={resetPrefs} aria-label="Reset appearance settings to defaults">
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Reset
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <OptionGroup<ThemePreference>
            label="Theme"
            value={prefs.theme}
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
              { value: 'system', label: 'Match system' },
            ]}
            onChange={(theme) => setPrefs({ theme })}
          />
          <OptionGroup<UiScale>
            label="Text size"
            value={prefs.ui_scale}
            options={[
              { value: 'sm', label: 'Small' },
              { value: 'md', label: 'Default' },
              { value: 'lg', label: 'Large' },
            ]}
            onChange={(ui_scale) => setPrefs({ ui_scale })}
          />
          <OptionGroup<FontFamilyPreference>
            label="Font"
            value={prefs.font_family}
            options={[
              { value: 'default', label: 'Default' },
              { value: 'readable', label: 'Atkinson Hyperlegible' },
              { value: 'dyslexic', label: 'OpenDyslexic' },
            ]}
            onChange={(font_family) => setPrefs({ font_family })}
          />
          <OptionGroup<EditorThemePreference>
            label="Code editor theme"
            value={prefs.editor_theme}
            options={[
              { value: 'vs-dark', label: 'Match app' },
              { value: 'vs', label: 'Light' },
              { value: 'hc-black', label: 'High contrast dark' },
              { value: 'hc-light', label: 'High contrast light' },
            ]}
            onChange={(editor_theme) => setPrefs({ editor_theme })}
          />
          <div className="space-y-1.5">
            <label htmlFor="mp-editor-font-size" className="text-xs font-semibold mp-muted flex justify-between">
              <span>Code font size</span>
              <span aria-hidden="true">{prefs.editor_font_size}px</span>
            </label>
            <input
              id="mp-editor-font-size"
              type="range"
              min={10}
              max={28}
              step={1}
              value={prefs.editor_font_size}
              onChange={(e) => setPrefs({ editor_font_size: Number(e.target.value) })}
              className="w-full accent-yellow-300"
              aria-valuetext={`${prefs.editor_font_size} pixels`}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Toggle
              label="High contrast"
              hint="Stronger text, borders and focus outlines."
              checked={prefs.high_contrast}
              onChange={(high_contrast) => setPrefs({ high_contrast })}
            />
            <Toggle
              label="Reduce motion"
              hint="Turns off animations, transitions and the solve confetti."
              checked={prefs.reduced_motion}
              onChange={(reduced_motion) => setPrefs({ reduced_motion })}
            />
            <Toggle
              label="Focus mode while solving"
              hint="Hides the sidebar and header in a question. Toggle with F, exit with Esc."
              checked={prefs.focus_mode}
              onChange={(focus_mode) => setPrefs({ focus_mode })}
            />
            <Toggle
              label="Keyboard shortcuts"
              hint="Single-key shortcuts like J/K, G then D. Press ? to see them all."
              checked={prefs.shortcuts_enabled}
              onChange={(shortcuts_enabled) => setPrefs({ shortcuts_enabled })}
            />
          </div>

          {/* Live preview */}
          <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-card-alt)' }}>
            <p className="text-[11px] uppercase tracking-wide mp-faint">Preview</p>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              1. Two Sum <span className="mp-chip mp-diff-Easy ml-1 text-[10px]">Easy</span>
            </p>
            <p className="text-xs mp-muted">Find two numbers that add up to the target. Use a hash map for O(n).</p>
            <pre
              aria-label="Code editor preview"
              className="rounded-lg p-3 overflow-x-auto font-mono leading-relaxed"
              style={{ backgroundColor: ed.bg, color: ed.fg, fontSize: `${prefs.editor_font_size}px` }}
            >
              <span style={{ color: ed.kw }}>def</span> twoSum(nums, target):{'\n'}
              {'    '}seen = {'{}'}  <span style={{ color: ed.cm }}># value → index</span>{'\n'}
              {'    '}<span style={{ color: ed.kw }}>for</span> i, x <span style={{ color: ed.kw }}>in</span> enumerate(nums):{'\n'}
              {'        '}<span style={{ color: ed.kw }}>if</span> target - x <span style={{ color: ed.kw }}>in</span> seen: <span style={{ color: ed.kw }}>return</span> [seen[target - x], i]{'\n'}
              {'        '}seen[x] = i{'\n'}
              {'    '}<span style={{ color: ed.kw }}>return</span> [<span style={{ color: ed.num }}>-1</span>, <span style={{ color: ed.num }}>-1</span>]
            </pre>
            <p className="text-[11px] mp-faint flex items-center gap-1">
              <Keyboard className="w-3 h-3" aria-hidden="true" /> Press <kbd className="font-mono">?</kbd> anywhere for shortcuts.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
