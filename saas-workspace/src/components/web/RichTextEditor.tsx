import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';

type BlockStyle = 'heading' | 'paragraph';

export interface RichTextEditorProps {
  label: string;
  onChange: (html: string) => void;
  placeholder?: string;
  resetKey: string;
  value: string;
}

const allowedElements = new Set([
  'B',
  'BR',
  'DIV',
  'H2',
  'P',
  'STRONG',
  'U',
]);

export function cleanEditorHtml(html: string) {
  if (typeof document === 'undefined') return html;

  const template = document.createElement('template');
  template.innerHTML = html;

  const cleanNode = (node: Node) => {
    if (!(node instanceof HTMLElement)) return;

    if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') {
      node.remove();
      return;
    }

    [...node.childNodes].forEach(cleanNode);
    [...node.attributes].forEach((attribute) =>
      node.removeAttribute(attribute.name),
    );

    if (!allowedElements.has(node.tagName)) {
      node.replaceWith(...node.childNodes);
    }
  };

  [...template.content.childNodes].forEach(cleanNode);
  return template.innerHTML;
}

export function RichTextEditor({
  label,
  onChange,
  placeholder = 'Start writing…',
  resetKey,
  value,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const labelId = useId();
  const [blockStyle, setBlockStyle] = useState<BlockStyle>('paragraph');

  const emitChange = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const hasText = Boolean(editor.textContent?.trim());
    const hasBreak = Boolean(editor.querySelector('br'));
    onChange(hasText || hasBreak ? cleanEditorHtml(editor.innerHTML) : '');
  }, [onChange]);

  const captureSelection = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;

    savedRangeRef.current = range.cloneRange();
    const block = document.queryCommandValue('formatBlock').toLowerCase();
    setBlockStyle(block === 'h2' ? 'heading' : 'paragraph');
  }, []);

  const runCommand = useCallback(
    (command: 'bold' | 'formatBlock' | 'underline', value?: string) => {
      const editor = editorRef.current;
      if (!editor) return;

      editor.focus();
      const selection = window.getSelection();
      if (selection && savedRangeRef.current) {
        selection.removeAllRanges();
        selection.addRange(savedRangeRef.current);
      }

      document.execCommand(command, false, value);
      captureSelection();
      emitChange();
    },
    [captureSelection, emitChange],
  );

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.innerHTML = cleanEditorHtml(value);
    savedRangeRef.current = null;
    setBlockStyle('paragraph');
    // Reset only when a different note or document opens. Updating the DOM
    // after every keystroke would move the caret back to the beginning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;

    if (event.key.toLowerCase() === 'i') {
      event.preventDefault();
      return;
    }

    const command = {
      b: 'bold',
      u: 'underline',
    }[event.key.toLowerCase()] as 'bold' | 'underline' | undefined;

    if (!command) return;
    event.preventDefault();
    runCommand(command);
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    document.execCommand(
      'insertText',
      false,
      event.clipboardData.getData('text/plain'),
    );
    emitChange();
  };

  return (
    <div className="rm-rich-text-field">
      <span className="rm-rich-text-field__label" id={labelId}>
        {label}
      </span>
      <div
        aria-label="Text style"
        className="rm-rich-text-toolbar"
        role="toolbar"
      >
        <button
          aria-pressed={blockStyle === 'heading'}
          onClick={() => runCommand('formatBlock', 'h2')}
          onMouseDown={(event) => event.preventDefault()}
          type="button"
        >
          Heading
        </button>
        <button
          aria-pressed={blockStyle === 'paragraph'}
          onClick={() => runCommand('formatBlock', 'p')}
          onMouseDown={(event) => event.preventDefault()}
          type="button"
        >
          Paragraph
        </button>
        <span aria-label="Keyboard shortcuts" className="rm-rich-text-toolbar__shortcuts">
          ⌘B · ⌘U
        </span>
      </div>
      <div
        aria-labelledby={labelId}
        aria-multiline="true"
        className="rm-rich-editor"
        contentEditable
        data-placeholder={placeholder}
        onBlur={captureSelection}
        onInput={() => {
          captureSelection();
          emitChange();
        }}
        onKeyDown={handleKeyDown}
        onKeyUp={captureSelection}
        onMouseUp={captureSelection}
        onPaste={handlePaste}
        ref={editorRef}
        role="textbox"
        suppressContentEditableWarning
      />
    </div>
  );
}
