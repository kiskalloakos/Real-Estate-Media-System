import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';

type BlockStyle = 'p' | 'h2' | 'h3';
type FormatCommand = 'bold' | 'formatBlock' | 'underline' | 'createLink' | 'insertHTML' | 'unlink';

export interface RichTextEditorProps {
  label: string;
  onChange: (html: string, text: string) => void;
  placeholder?: string;
  resetKey: string;
  value: string;
  page?: boolean;
}

const allowedElements = new Set([
  'A', 'B', 'BLOCKQUOTE', 'BR', 'CODE', 'DIV', 'H2', 'H3', 'HR',
  'LI', 'OL', 'P', 'PRE', 'STRONG', 'U', 'UL',
]);

function safeHref(value: string) {
  try {
    const url = new URL(value);
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

export function cleanEditorHtml(html: string) {
  if (typeof document === 'undefined') return '';

  const template = document.createElement('template');
  template.innerHTML = html;

  const cleanNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) return;
    if (!(node instanceof HTMLElement) || node.tagName === 'SCRIPT' || node.tagName === 'STYLE') {
      node.parentNode?.removeChild(node);
      return;
    }
    const href = node.tagName === 'A' ? safeHref(node.getAttribute('href') ?? '') : '';
    [...node.childNodes].forEach(cleanNode);
    [...node.attributes].forEach(attribute => node.removeAttribute(attribute.name));

    if (!allowedElements.has(node.tagName) || (node.tagName === 'A' && !href)) {
      node.replaceWith(...node.childNodes);
    } else if (href) {
      node.setAttribute('href', href);
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  };

  [...template.content.childNodes].forEach(cleanNode);
  return template.innerHTML;
}

export function RichTextEditor({ resetKey, ...props }: RichTextEditorProps) {
  return <RichTextCanvas key={resetKey} {...props} />;
}

function RichTextCanvas({
  label,
  onChange,
  placeholder = 'Start writing…',
  value,
  page,
}: Omit<RichTextEditorProps, 'resetKey'>) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const initialValue = useRef(value);
  const labelId = useId();
  const [blockStyle, setBlockStyle] = useState<BlockStyle>('p');
  const [bold, setBold] = useState(false);
  const [underline, setUnderline] = useState(false);
  const [link, setLink] = useState<{ url: string; existing: boolean }>();
  const [linkError, setLinkError] = useState('');

  const emitChange = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const text = editor.innerText;
    const hasContent = Boolean(text.trim() || editor.querySelector('br,hr'));
    onChange(hasContent ? cleanEditorHtml(editor.innerHTML) : '', text);
  }, [onChange]);

  const captureSelection = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;

    savedRangeRef.current = range.cloneRange();
    const block = document.queryCommandValue('formatBlock').toLowerCase();
    setBlockStyle(block === 'h2' || block === 'h3' ? block : 'p');
    setBold(document.queryCommandState('bold'));
    setUnderline(document.queryCommandState('underline'));
  }, []);

  const runCommand = useCallback((command: FormatCommand, argument?: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const range = savedRangeRef.current;
    editor.focus();
    const selection = window.getSelection();
    if (selection && range && editor.contains(range.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    document.execCommand(command, false, argument);
    captureSelection();
    emitChange();
  }, [captureSelection, emitChange]);

  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = cleanEditorHtml(initialValue.current);
  }, []);

  const openLink = () => {
    captureSelection();
    const range = savedRangeRef.current;
    const node = range?.startContainer;
    const anchor = (node instanceof Element ? node : node?.parentElement)?.closest('a');
    const existing = Boolean(anchor && editorRef.current?.contains(anchor));
    if (anchor && range && existing) range.selectNodeContents(anchor);
    setLink({ url: existing ? anchor?.getAttribute('href') ?? '' : '', existing });
    setLinkError('');
  };

  const applyLink = () => {
    if (!link) return;
    const entered = link.url.trim();
    const href = entered && safeHref(/^[a-z][a-z0-9+.-]*:/i.test(entered) ? entered : `https://${entered}`);
    if (!href) {
      setLinkError('Enter a valid web or email address.');
      return;
    }

    if (savedRangeRef.current && !savedRangeRef.current.collapsed) {
      runCommand('createLink', href);
    } else {
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.textContent = entered;
      runCommand('insertHTML', anchor.outerHTML);
    }
    setLink(undefined);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'k') {
      event.preventDefault();
      event.stopPropagation();
      openLink();
    } else if (key === 'b' || key === 'u') {
      event.preventDefault();
      captureSelection();
      runCommand(key === 'b' ? 'bold' : 'underline');
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const html = cleanEditorHtml(event.clipboardData.getData('text/html'));
    if (html) document.execCommand('insertHTML', false, html);
    else document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
    emitChange();
  };

  return (
    <div className={page ? 'rm-rich-text-field pp-rich-text' : 'rm-rich-text-field'}>
      <span className={page ? 'rm-visually-hidden' : 'rm-rich-text-field__label'} id={labelId}>{label}</span>
      <div aria-label="Formatting" className="rm-rich-text-toolbar" role="group">
        <select aria-label="Text style" value={blockStyle} onChange={event => runCommand('formatBlock', event.target.value)}>
          <option value="p">Text</option>
          <option value="h2">Heading</option>
          <option value="h3">Subheading</option>
        </select>
        <button aria-label="Bold" aria-pressed={bold} type="button" title="Bold" onMouseDown={event => event.preventDefault()} onClick={() => runCommand('bold')}><strong>B</strong></button>
        <button aria-label="Underline" aria-pressed={underline} type="button" title="Underline" onMouseDown={event => event.preventDefault()} onClick={() => runCommand('underline')}><u>U</u></button>
        <button aria-expanded={Boolean(link)} type="button" onMouseDown={event => event.preventDefault()} onClick={openLink}>Link</button>
      </div>
      {link && <div className="rm-rich-link">
        <input aria-label="Link address" autoFocus placeholder="https://example.com" type="text" inputMode="url" value={link.url}
          onChange={event => { setLink({ ...link, url: event.target.value }); setLinkError(''); }}
          onKeyDown={event => {
            if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); applyLink(); }
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setLink(undefined); editorRef.current?.focus(); }
          }}/>
        <button type="button" onClick={applyLink}>Apply</button>
        {link.existing && <button type="button" onClick={() => { runCommand('unlink'); setLink(undefined); }}>Remove link</button>}
        <button type="button" onClick={() => { setLink(undefined); editorRef.current?.focus(); }}>Cancel</button>
        {linkError && <span role="alert">{linkError}</span>}
      </div>}
      <div
        aria-labelledby={labelId}
        aria-multiline="true"
        className="rm-rich-editor"
        contentEditable
        data-placeholder={placeholder}
        onBlur={captureSelection}
        onInput={() => { captureSelection(); emitChange(); }}
        onKeyDown={handleKeyDown}
        onKeyUp={captureSelection}
        onMouseUp={captureSelection}
        onTouchEnd={captureSelection}
        onPaste={handlePaste}
        onClick={event => {
          const anchor = (event.target as HTMLElement).closest('a');
          const href = anchor && safeHref(anchor.getAttribute('href') ?? '');
          if (href && window.getSelection()?.isCollapsed) {
            event.preventDefault();
            window.open(href, '_blank', 'noopener,noreferrer');
          }
        }}
        ref={editorRef}
        role="textbox"
        suppressContentEditableWarning
      />
    </div>
  );
}
