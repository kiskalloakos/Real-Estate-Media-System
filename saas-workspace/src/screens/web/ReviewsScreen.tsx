import { useMemo, useRef, useState, type FormEvent } from 'react';

import {
  Avatar,
  Button,
  Card,
  Icon,
  Modal,
  PageHeader,
  cleanEditorHtml,
  useToast,
  type PortalRole,
} from '@/components/web';

import { demoReviews } from './demoData';
import type { PropertySummary, ReviewItem, UpdateDeliverableInput, UploadDeliverableInput } from './types';

export interface ReviewsScreenProps {
  initialReviewId?: string;
  onArchive?: (reviewId: string) => void | Promise<void>;
  onBack?: () => void;
  onComment?: (reviewId: string, body: string, timestamp: string) => void | Promise<void>;
  onDecision?: (
    reviewId: string,
    decision: 'approval_revoked' | 'changes_requested' | 'approved',
  ) => void | Promise<void>;
  onUpdate?: (input: UpdateDeliverableInput) => void | Promise<void>;
  onUpload?: (input: UploadDeliverableInput) => Promise<void>;
  properties?: PropertySummary[];
  reviews?: ReviewItem[];
  role: PortalRole;
}

type ScriptPdfBlock = {
  kind: 'heading' | 'body';
  text: string;
};

const SCRIPT_PDF_LOGO_SRC = '/realty-media-brandmark-black.png';
const SCRIPT_PDF_WIDTH = 1440;
const SCRIPT_PDF_HEIGHT = 2036;
const SCRIPT_PDF_MARGIN_X = 210;
const SCRIPT_PDF_FIRST_PAGE_TOP = 270;
const SCRIPT_PDF_NEXT_PAGE_TOP = 150;
const SCRIPT_PDF_BOTTOM = 170;

function secondsFromTimestamp(value: string) {
  if (value === 'General') return null;
  const parts = value.split(':').map(Number);
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function formatVideoTimestamp(value: number) {
  const seconds = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function scriptPdfFilename(title: string) {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${slug || 'realty-media'}-script.pdf`;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load the PDF logo.'));
    image.src = src;
  });
}

function textWithLineBreaks(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (!(node instanceof HTMLElement)) return '';
  if (node.tagName === 'BR') return '\n';
  return Array.from(node.childNodes).map(textWithLineBreaks).join('');
}

function hasBlockChildren(element: HTMLElement) {
  return Array.from(element.children).some((child) =>
    /^(blockquote|div|h[1-6]|li|ol|p|pre|ul)$/i.test(child.tagName),
  );
}

function scriptHtmlToBlocks(scriptHtml: string): ScriptPdfBlock[] {
  const template = document.createElement('template');
  template.innerHTML = scriptHtml;
  const blocks: ScriptPdfBlock[] = [];

  const pushBlock = (kind: ScriptPdfBlock['kind'], text: string) => {
    const normalized = text
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (normalized) blocks.push({ kind, text: normalized });
  };

  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      pushBlock('body', node.textContent ?? '');
      return;
    }
    if (!(node instanceof HTMLElement)) return;

    const tagName = node.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tagName)) {
      pushBlock('heading', textWithLineBreaks(node));
      return;
    }
    if (tagName === 'li') {
      pushBlock('body', `- ${textWithLineBreaks(node)}`);
      return;
    }
    if (hasBlockChildren(node)) {
      Array.from(node.childNodes).forEach(visit);
      return;
    }
    if (['p', 'div', 'blockquote', 'pre'].includes(tagName)) {
      pushBlock('body', textWithLineBreaks(node));
      return;
    }
    Array.from(node.childNodes).forEach(visit);
  };

  Array.from(template.content.childNodes).forEach(visit);
  if (!blocks.length) pushBlock('body', template.content.textContent ?? '');
  return blocks;
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const wrappedLines: string[] = [];
  const explicitLines = text.split('\n');
  explicitLines.forEach((line) => {
    const words = line.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      wrappedLines.push('');
      return;
    }

    let currentLine = '';
    words.forEach((word) => {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (context.measureText(candidate).width <= maxWidth) {
        currentLine = candidate;
        return;
      }
      if (currentLine) wrappedLines.push(currentLine);
      currentLine = word;
    });
    if (currentLine) wrappedLines.push(currentLine);
  });
  return wrappedLines;
}

function buildPdfFromJpegs(jpegDataUrls: string[]) {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const objects: string[] = [];
  const pageRefs: number[] = [];
  let nextObject = 3;

  jpegDataUrls.forEach(() => {
    pageRefs.push(nextObject);
    nextObject += 3;
  });

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(' ')}] /Count ${pageRefs.length} >>`;

  jpegDataUrls.forEach((dataUrl, index) => {
    const pageRef = pageRefs[index];
    const imageRef = pageRef + 1;
    const contentRef = pageRef + 2;
    const imageBytes = atob(dataUrl.split(',')[1] ?? '');
    const imageName = `Im${index + 1}`;
    const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/${imageName} Do\nQ`;

    objects[pageRef] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /${imageName} ${imageRef} 0 R >> >> /Contents ${contentRef} 0 R >>`;
    objects[imageRef] = `<< /Type /XObject /Subtype /Image /Width ${SCRIPT_PDF_WIDTH} /Height ${SCRIPT_PDF_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n${imageBytes}\nendstream`;
    objects[contentRef] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  let output = '%PDF-1.4\n%\xFF\xFF\xFF\xFF\n';
  const offsets = [0];
  for (let objectNumber = 1; objectNumber < objects.length; objectNumber += 1) {
    offsets[objectNumber] = output.length;
    output += `${objectNumber} 0 obj\n${objects[objectNumber]}\nendobj\n`;
  }
  const xrefOffset = output.length;
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let objectNumber = 1; objectNumber < objects.length; objectNumber += 1) {
    output += `${String(offsets[objectNumber]).padStart(10, '0')} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const pdfBytes = new Uint8Array(output.length);
  for (let index = 0; index < output.length; index += 1) {
    pdfBytes[index] = output.charCodeAt(index) & 0xff;
  }
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

async function downloadScriptPdf(title: string, scriptHtml: string) {
  const logo = await loadImage(SCRIPT_PDF_LOGO_SRC);
  const blocks = scriptHtmlToBlocks(scriptHtml);
  const canvases: HTMLCanvasElement[] = [];
  let canvas = document.createElement('canvas');
  let context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create the PDF canvas.');

  const maxTextWidth = SCRIPT_PDF_WIDTH - SCRIPT_PDF_MARGIN_X * 2;
  let y = 0;
  let isFirstPage = true;

  const startPage = () => {
    canvas = document.createElement('canvas');
    canvas.width = SCRIPT_PDF_WIDTH;
    canvas.height = SCRIPT_PDF_HEIGHT;
    context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create the PDF canvas.');

    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, SCRIPT_PDF_WIDTH, SCRIPT_PDF_HEIGHT);
    context.fillStyle = '#000000';
    context.textBaseline = 'top';

    if (isFirstPage) {
      const logoWidth = 155;
      const logoHeight = logoWidth * (logo.naturalHeight / logo.naturalWidth);
      context.drawImage(logo, (SCRIPT_PDF_WIDTH - logoWidth) / 2, 95, logoWidth, logoHeight);
      y = SCRIPT_PDF_FIRST_PAGE_TOP;
      isFirstPage = false;
    } else {
      y = SCRIPT_PDF_NEXT_PAGE_TOP;
    }
    canvases.push(canvas);
  };

  const ensureSpace = (height: number) => {
    if (y + height <= SCRIPT_PDF_HEIGHT - SCRIPT_PDF_BOTTOM) return;
    startPage();
  };

  startPage();

  blocks.forEach((block) => {
    if (!context) return;
    const isHeading = block.kind === 'heading';
    const fontSize = isHeading ? 36 : 28;
    const lineHeight = isHeading ? 48 : 44;
    const gapAfter = isHeading ? 24 : 20;
    context.font = `${isHeading ? '700' : '400'} ${fontSize}px Arial, sans-serif`;

    const lines = wrapCanvasText(context, block.text, maxTextWidth);
    if (isHeading) ensureSpace(lineHeight * Math.min(lines.length + 1, 2));
    lines.forEach((line) => {
      ensureSpace(lineHeight);
      if (line) context?.fillText(line, SCRIPT_PDF_MARGIN_X, y);
      y += line ? lineHeight : lineHeight * 0.6;
    });
    y += gapAfter;
  });

  const pdfBlob = buildPdfFromJpegs(canvases.map((page) => page.toDataURL('image/jpeg', 0.94)));
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = scriptPdfFilename(title);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ReviewsScreen({
  initialReviewId,
  onArchive,
  onBack,
  onComment,
  onUpdate,
  onUpload,
  properties = [],
  reviews,
  role,
}: ReviewsScreenProps) {
  const { notify } = useToast();
  const roleReviews =
    reviews ??
    (role === 'client'
      ? demoReviews.filter((review) => review.clientName === 'Cabana The One')
      : demoReviews);
  const [activeId, setActiveId] = useState(initialReviewId ?? roleReviews[0]?.id ?? '');
  const [comment, setComment] = useState('');
  const [commentTime, setCommentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [formError, setFormError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [uploadForm, setUploadForm] = useState<Omit<UploadDeliverableInput, 'file'> & { file: File | null }>({
    file: null,
    kind: 'video',
    propertyId: properties[0]?.id ?? '',
    title: '',
  });
  const [editForm, setEditForm] = useState<Omit<UpdateDeliverableInput, 'mediaAssetId'>>({
    clientVisible: true,
    propertyId: '',
    status: 'draft',
    title: '',
  });

  const activeReview =
    roleReviews.find((review) => review.id === activeId) ?? roleReviews[0];
  const isScriptReview = activeReview?.kind === 'script';
  const activeScriptHtml = useMemo(
    () => activeReview?.contentHtml ? cleanEditorHtml(activeReview.contentHtml) : '',
    [activeReview],
  );
  const effectiveDuration = videoDuration || activeReview?.durationSeconds || 0;
  const timestamp = formatVideoTimestamp(
    effectiveDuration ? Math.min(commentTime, effectiveDuration) : commentTime,
  );

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeReview || !comment.trim()) return;
    if (!isScriptReview && effectiveDuration && commentTime > effectiveDuration) {
      setFormError('Choose a moment within the video before sending this comment.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await onComment?.(activeReview.id, comment.trim(), isScriptReview ? 'General' : timestamp);
      setComment('');
      notify('Comment added to this review.');
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not add the comment.');
    } finally {
      setSaving(false);
    }
  };

  const selectReview = (reviewId: string) => {
    setActiveId(reviewId);
    setComment('');
    setCommentTime(0);
    setVideoDuration(0);
    setFormError('');
  };

  const seekToTimestamp = (value: string) => {
    const requestedSeconds = secondsFromTimestamp(value);
    const video = videoRef.current;
    if (requestedSeconds == null || !video) return;
    const duration = Number.isFinite(video.duration) ? video.duration : effectiveDuration;
    const target = duration ? Math.min(requestedSeconds, duration) : requestedSeconds;
    video.currentTime = target;
    setCommentTime(target);
    void video.play().catch(() => undefined);
  };

  const submitUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onUpload || !uploadForm.file) return;
    setSaving(true);
    setFormError('');
    try {
      await onUpload({ ...uploadForm, file: uploadForm.file });
      setUploadOpen(false);
      setUploadForm({
        file: null,
        kind: 'video',
        propertyId: properties[0]?.id ?? '',
        title: '',
      });
      notify('Deliverable uploaded to the review room.');
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not upload the deliverable.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = () => {
    if (!activeReview) return;
    setFormError('');
    setEditForm({
      clientVisible: activeReview.status !== 'draft',
      propertyId: activeReview.propertyId ?? '',
      status: activeReview.status === 'draft' ? 'draft' : 'ready_for_review',
      title: activeReview.title,
    });
    setEditOpen(true);
  };

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeReview || !onUpdate || !editForm.title.trim() || !editForm.propertyId) return;
    setSaving(true);
    setFormError('');
    try {
      await onUpdate({ ...editForm, mediaAssetId: activeReview.id });
      setEditOpen(false);
      notify('Content updated.');
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not update the content.');
    } finally {
      setSaving(false);
    }
  };

  const deleteReview = async () => {
    if (!activeReview || !onArchive) return;
    if (!window.confirm(`Delete “${activeReview.title}” and all of its versions and review comments?`)) return;
    setSaving(true);
    try {
      await onArchive(activeReview.id);
      setActiveId('');
      notify('Content deleted.');
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Could not delete the content.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const exportScriptPdf = async () => {
    if (!activeReview || !activeScriptHtml) return;
    setExportingPdf(true);
    try {
      await downloadScriptPdf(activeReview.title, activeScriptHtml);
      notify('Script PDF exported.');
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Could not export the script PDF.', 'error');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="rm-page rm-reviews-page">
      <PageHeader
        actions={
          <div className="rm-review-page-actions">
            {onBack ? (
              <Button icon="chevron-left" onClick={onBack} variant="secondary">
                Back
              </Button>
            ) : <span />}
            <div className="rm-review-page-actions__right">
              <label className="rm-review-picker">
                <span className="rm-visually-hidden">Choose content to review</span>
                <select
                  disabled={!roleReviews.length}
                  onChange={(event) => selectReview(event.target.value)}
                  value={activeReview?.id ?? ''}
                >
                  {!roleReviews.length ? <option value="">No content to review</option> : null}
                  {roleReviews.map((review) => (
                    <option key={review.id} value={review.id}>
                      {review.title} · {review.propertyName} · {review.version}
                    </option>
                  ))}
                </select>
              </label>
              {role !== 'client' ? (
                <Button
                  icon="upload"
                  onClick={() => {
                    setFormError('');
                    setUploadForm((current) => ({
                      ...current,
                      propertyId: current.propertyId || properties[0]?.id || '',
                    }));
                    setUploadOpen(true);
                  }}
                >
                  Upload deliverable
                </Button>
              ) : null}
            </div>
          </div>
        }
        title="Review room"
      />

      <div className={`rm-review-workspace${isScriptReview ? ' rm-review-workspace--script' : ''}`}>
        {activeReview ? (
          <>
            <Card className={`rm-video-review${isScriptReview ? ' rm-script-review' : ''}`} tone="bright">
              <div className="rm-video-review__header">
                <div>
                  <p className="rm-section-kicker">{activeReview.propertyName} · {activeReview.version}</p>
                  <h2>{activeReview.title}</h2>
                </div>
                <div>
                  {role !== 'client' ? <Button onClick={openEdit} variant="secondary">Edit</Button> : null}
                  {isScriptReview ? (
                    <Button
                      disabled={!activeScriptHtml || exportingPdf}
                      icon="download"
                      onClick={() => void exportScriptPdf()}
                      variant="secondary"
                    >
                      {exportingPdf ? 'Exporting...' : 'Export PDF'}
                    </Button>
                  ) : null}
                  {!isScriptReview && activeReview.fileUrl ? (
                    <Button
                      icon="download"
                      onClick={() => window.open(activeReview.fileUrl, '_blank', 'noopener,noreferrer')}
                      variant="secondary"
                    >
                      Download file
                    </Button>
                  ) : null}
                  {role !== 'client' ? (
                    <Button disabled={saving} onClick={() => void deleteReview()} variant="danger">
                      Delete
                    </Button>
                  ) : null}
                </div>
              </div>

              {activeReview.kind === 'script' && activeScriptHtml ? (
                <div className="rm-script-review__document">
                  <div
                    className="rm-review-script-preview"
                    dangerouslySetInnerHTML={{ __html: activeScriptHtml }}
                  />
                </div>
              ) : activeReview.fileUrl && activeReview.mimeType?.startsWith('video/') ? (
                <video
                  key={activeReview.id}
                  className="rm-video-frame rm-video-frame--native"
                  controls
                  onLoadedMetadata={(event) => {
                    const duration = Number.isFinite(event.currentTarget.duration)
                      ? event.currentTarget.duration
                      : 0;
                    setVideoDuration(duration);
                    setCommentTime((current) => (duration ? Math.min(current, duration) : current));
                  }}
                  onTimeUpdate={(event) => setCommentTime(event.currentTarget.currentTime)}
                  preload="metadata"
                  ref={videoRef}
                  src={activeReview.fileUrl}
                />
              ) : (
                <div className="rm-video-frame">
                  {activeReview.thumbnailUrl ? (
                    <img alt={`${activeReview.title} preview`} src={activeReview.thumbnailUrl} />
                  ) : (
                    <Icon name="play" size={30} />
                  )}
                  <span className="rm-video-frame__shade" />
                  <button
                    aria-label={`Open ${activeReview.title}`}
                    className="rm-video-frame__play"
                    onClick={() => {
                      if (activeReview.fileUrl) {
                        window.open(activeReview.fileUrl, '_blank', 'noopener,noreferrer');
                      } else {
                        notify('No playable file is attached to this review yet.', 'info');
                      }
                    }}
                    type="button"
                  >
                    <Icon name="play" size={24} />
                  </button>
                  <span className="rm-video-frame__timecode">{activeReview.fileUrl ? 'Open file' : 'Preview only'}</span>
                </div>
              )}
            </Card>

            <Card className="rm-comment-panel" tone="bright">
              {isScriptReview ? null : (
                <header className="rm-comment-panel__header">
                  <div>
                    <p className="rm-section-kicker">Conversation</p>
                    <h2>Timestamped comments</h2>
                  </div>
                  <span aria-label={`${activeReview.comments.length} comments`}>
                    {activeReview.comments.length}
                  </span>
                </header>
              )}
              <div className="rm-comment-list">
                {activeReview.comments.map((item) => {
                  const commentSeconds = secondsFromTimestamp(item.timestamp);
                  const displayedTimestamp =
                    commentSeconds != null && effectiveDuration
                      ? formatVideoTimestamp(Math.min(commentSeconds, effectiveDuration))
                      : item.timestamp;
                  return (
                    <article key={item.id}>
                      <Avatar name={item.author} size="sm" src={item.avatarUrl} />
                      <div>
                        <header>
                          <strong>{item.author}</strong>
                          {isScriptReview ? null : commentSeconds != null ? (
                            <button onClick={() => seekToTimestamp(item.timestamp)} type="button">
                              <Icon name="play" size={11} />
                              {displayedTimestamp}
                            </button>
                          ) : <span>{item.timestamp}</span>}
                        </header>
                        <p>{item.body}</p>
                      </div>
                    </article>
                  );
                })}
                {!activeReview.comments.length ? (
                  <div className="rm-comment-empty">
                    <Icon name="message" size={22} />
                    <strong>No comments yet</strong>
                    <span>{isScriptReview ? 'Leave the first note on this script.' : 'Start the conversation at the current timestamp.'}</span>
                  </div>
                ) : null}
              </div>
              <form className="rm-comment-form" onSubmit={submitComment}>
                {formError ? <div className="rm-feedback rm-feedback--error" role="alert">{formError}</div> : null}
                {isScriptReview ? null : (
                  <output className="rm-comment-form__timestamp" aria-label="Current video timestamp">
                    {timestamp}{effectiveDuration ? ` / ${formatVideoTimestamp(effectiveDuration)}` : ''}
                  </output>
                )}
                <label>
                  <span className="rm-visually-hidden">Add a comment</span>
                  <textarea
                    onChange={(event) => setComment(event.target.value)}
                    placeholder={isScriptReview ? 'Leave a note on this script…' : 'Leave feedback at this moment…'}
                    rows={2}
                    value={comment}
                  />
                </label>
                <Button disabled={saving || !comment.trim()} icon="arrow-right" type="submit">
                  {saving ? 'Sending…' : 'Send'}
                </Button>
              </form>
            </Card>
          </>
        ) : (
          <Card className="rm-review-stage rm-review-stage--empty" tone="bright">
            <Icon name="play" size={28} />
            <h2>Nothing in this view.</h2>
          </Card>
        )}
      </div>

      <Modal
        onClose={() => setUploadOpen(false)}
        open={uploadOpen}
        title="Upload deliverable"
      >
        <form className="rm-action-form" onSubmit={submitUpload}>
          {formError ? <div className="rm-feedback rm-feedback--error" role="alert">{formError}</div> : null}
          {!properties.length ? <div className="rm-feedback rm-feedback--warning">Add a property before uploading its first deliverable.</div> : null}
          <label className="rm-field">
            <span>Property</span>
            <select
              disabled={!properties.length}
              onChange={(event) => setUploadForm((current) => ({ ...current, propertyId: event.target.value }))}
              required
              value={uploadForm.propertyId}
            >
              <option value="">Choose a property</option>
              {properties.map((property) => <option key={property.id} value={property.id}>{property.name} · {property.clientName}</option>)}
            </select>
          </label>
          <div className="rm-form-grid rm-form-grid--two">
            <label className="rm-field">
              <span>Title</span>
              <input onChange={(event) => setUploadForm((current) => ({ ...current, title: event.target.value }))} placeholder="Summer hero reel" required value={uploadForm.title} />
            </label>
            <label className="rm-field">
              <span>Type</span>
              <select onChange={(event) => setUploadForm((current) => ({ ...current, kind: event.target.value as UploadDeliverableInput['kind'] }))} value={uploadForm.kind}>
                <option value="video">Video</option>
                <option value="script">Script</option>
              </select>
            </label>
          </div>
          <label className="rm-upload-tile">
            <input
              accept={uploadForm.kind === 'video' ? 'video/*' : '.pdf,.doc,.docx,.html,.md,.txt'}
              onChange={(event) => setUploadForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))}
              required
              type="file"
            />
            <span className="rm-upload-tile__icon"><Icon name="upload" size={21} /></span>
            <strong>{uploadForm.file?.name ?? 'Choose a deliverable file'}</strong>
          </label>
          <footer className="rm-dialog-actions">
            <Button disabled={saving} onClick={() => setUploadOpen(false)} variant="secondary">Cancel</Button>
            <Button disabled={saving || !properties.length || !uploadForm.file || !uploadForm.title.trim()} type="submit">{saving ? 'Uploading…' : 'Upload deliverable'}</Button>
          </footer>
        </form>
      </Modal>

      <Modal
        onClose={() => setEditOpen(false)}
        open={editOpen}
        title="Edit content"
      >
        <form className="rm-action-form" onSubmit={submitEdit}>
          {formError ? <div className="rm-feedback rm-feedback--error" role="alert">{formError}</div> : null}
          <label className="rm-field">
            <span>Title</span>
            <input onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))} required value={editForm.title} />
          </label>
          <label className="rm-field">
            <span>Recorded for property</span>
            <select onChange={(event) => setEditForm((current) => ({ ...current, propertyId: event.target.value }))} required value={editForm.propertyId}>
              <option value="">Choose a property</option>
              {properties.map((property) => <option key={property.id} value={property.id}>{property.name} · {property.clientName}</option>)}
            </select>
          </label>
          <footer className="rm-dialog-actions">
            <Button disabled={saving} onClick={() => setEditOpen(false)} variant="secondary">Cancel</Button>
            <Button disabled={saving || !editForm.title.trim() || !editForm.propertyId} type="submit">{saving ? 'Saving…' : 'Save changes'}</Button>
          </footer>
        </form>
      </Modal>
    </div>
  );
}
