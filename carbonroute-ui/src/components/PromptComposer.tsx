import { useEffect, useId, useRef } from 'react';
import { ArrowUp, Command, Cpu, Square } from './Icons';

export const MAX_PROMPT_CHARS = 4000;

export interface PromptComposerProps {
  prompt: string;
  setPrompt: (val: string) => void;
  allowedModels: string[];
  selectedModel: string;
  onSelectModel: (model: string) => void;
  loading: boolean;
  onSubmitPrompt: (promptText: string) => void;
  onCancel: () => void;
}

export function PromptComposer({
  prompt,
  setPrompt,
  allowedModels,
  selectedModel,
  onSelectModel,
  loading,
  onSubmitPrompt,
  onCancel,
}: PromptComposerProps) {
  const textareaId = useId();
  const modelSelectId = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastCompositionEndAtRef = useRef<number | null>(null);

  // Keep textarea height synced dynamically between 72px and 200px
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(200, Math.max(72, el.scrollHeight));
    el.style.height = `${nextHeight}px`;
  }, [prompt]);

  // Global Cmd/Ctrl+K focus shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || !prompt.trim()) return;
    onSubmitPrompt(prompt);
  };

  // IME-safe Enter-to-submit handler (Enter submits, Shift+Enter inserts newline)
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();

      if (event.nativeEvent.isComposing) {
        return;
      }

      if (
        lastCompositionEndAtRef.current !== null &&
        Math.abs(event.timeStamp - lastCompositionEndAtRef.current) < 50
      ) {
        return;
      }

      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <form className="composer-card" onSubmit={handleFormSubmit}>
      <div className="composer-input-wrap">
        <label htmlFor={textareaId} className="visually-hidden">
          Inference prompt
        </label>
        <textarea
          ref={textareaRef}
          id={textareaId}
          name="prompt"
          value={prompt}
          maxLength={MAX_PROMPT_CHARS}
          onChange={(e) => setPrompt(e.target.value)}
          onCompositionEnd={(e) => {
            lastCompositionEndAtRef.current = e.timeStamp;
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything to route across low-carbon global compute zones..."
          className="composer-textarea"
          rows={2}
          required
          disabled={loading}
        />
      </div>

      <div className="composer-toolbar">
        <div className="composer-toolbar-left">
          <div className="model-picker-wrap">
            <Cpu size={13} className="text-muted" />
            <label htmlFor={modelSelectId} className="visually-hidden">
              Target model
            </label>
            <select
              id={modelSelectId}
              name="model"
              value={selectedModel}
              disabled={loading || allowedModels.length === 0}
              onChange={(e) => onSelectModel(e.target.value)}
              className="model-select-control mono-tabular"
            >
              {allowedModels.length === 0 ? (
                <option value="">Loading models...</option>
              ) : (
                allowedModels.map((modelId) => (
                  <option key={modelId} value={modelId}>
                    {modelId}
                  </option>
                ))
              )}
            </select>
          </div>

          <span className="char-counter mono-tabular" aria-live="off">
            {prompt.length.toLocaleString()} / {MAX_PROMPT_CHARS.toLocaleString()}
          </span>
        </div>

        <div className="composer-toolbar-right">
          <kbd className="kbd-hint mono-tabular" title="Focus prompt (Cmd or Ctrl + K)">
            <Command size={11} />
            <span>K</span>
          </kbd>

          {loading ? (
            <button
              type="button"
              onClick={onCancel}
              className="btn-cancel-route"
            >
              <Square size={12} />
              <span>Cancel</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!prompt.trim()}
              className="btn-route-primary"
            >
              <span>Route</span>
              <ArrowUp size={14} />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
