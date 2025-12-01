'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Markdown } from 'tiptap-markdown';
import { useCallback, useEffect, useState, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { Bold, Italic, Link as LinkIcon, List, ListOrdered, Heading3, Code } from 'lucide-react';

type SaveStatus = 'saved' | 'saving' | 'unsaved';

interface MarkdownEditorProps {
  initialContent: string;
  onSave: (markdown: string) => Promise<void>;
  className?: string;
  minHeight?: string;
}

export function MarkdownEditor({
  initialContent,
  onSave,
  className = '',
  minHeight = '200px',
}: MarkdownEditorProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const isSettingContent = useRef(false);

  const saveContent = useCallback(async (markdown: string) => {
    setSaveStatus('saving');
    try {
      await onSave(markdown);
      setSaveStatus('saved');
    } catch (error) {
      setSaveStatus('unsaved');
      console.error('Failed to save:', error);
    }
  }, [onSave]);

  const debouncedSave = useDebouncedCallback(saveContent, 1500);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [3],
        },
        blockquote: false,
        horizontalRule: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-500 underline',
        },
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: `prose prose-sm prose-invert max-w-none focus:outline-none px-3 py-2`,
        style: `min-height: ${minHeight}`,
      },
    },
    onUpdate: ({ editor }) => {
      if (isSettingContent.current) return;
      setSaveStatus('unsaved');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const markdown = (editor.storage as any).markdown.getMarkdown();
      debouncedSave(markdown);
    },
  });

  // Update editor when initialContent changes externally
  useEffect(() => {
    if (editor && initialContent && !editor.getText().trim()) {
      isSettingContent.current = true;
      editor.commands.setContent(initialContent);
      requestAnimationFrame(() => {
        isSettingContent.current = false;
      });
    }
  }, [editor, initialContent]);

  // Save on blur
  useEffect(() => {
    const handleBlur = () => {
      if (editor && saveStatus === 'unsaved') {
        debouncedSave.flush();
      }
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [editor, saveStatus, debouncedSave]);

  const setLink = useCallback(() => {
    if (!editor) return;

    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) return;

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className={`border rounded-md ${className}`} style={{ borderColor: 'rgba(255,255,255,0.06)', backgroundColor: '#0a0a0a' }}>
      <style>{`
        .ProseMirror p {
          margin-bottom: 0.75em;
        }
        .ProseMirror p:last-child {
          margin-bottom: 0;
        }
        .ProseMirror ul, .ProseMirror ol {
          margin-bottom: 0.75em;
          padding-left: 1.5em;
        }
        .ProseMirror li {
          margin-bottom: 0.25em;
        }
        .ProseMirror h3 {
          font-size: 1.1em;
          font-weight: 600;
          margin-bottom: 0.5em;
        }
        .ProseMirror code {
          background: rgba(255,255,255,0.1);
          padding: 0.1em 0.3em;
          border-radius: 3px;
          font-size: 0.9em;
        }
        .ProseMirror pre {
          background: rgba(255,255,255,0.05);
          padding: 0.75em;
          border-radius: 4px;
          margin-bottom: 0.75em;
          overflow-x: auto;
        }
        .ProseMirror pre code {
          background: none;
          padding: 0;
        }
      `}</style>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <div className="w-px h-4 mx-1" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="Heading"
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <div className="w-px h-4 mx-1" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive('code')}
          title="Inline Code"
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={setLink}
          isActive={editor.isActive('link')}
          title="Add Link"
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>

        {/* Save status indicator */}
        <div className="ml-auto text-xs" style={{ color: '#666' }}>
          {saveStatus === 'saving' && 'Saving...'}
          {saveStatus === 'saved' && 'Saved'}
          {saveStatus === 'unsaved' && 'Unsaved changes'}
        </div>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  onClick,
  isActive,
  title,
  children,
}: {
  onClick: () => void;
  isActive: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="p-1.5 rounded transition-colors"
      style={{
        backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
        color: isActive ? '#fafafa' : '#888',
      }}
    >
      {children}
    </button>
  );
}
