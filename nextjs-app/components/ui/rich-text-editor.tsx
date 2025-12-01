'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { useCallback, useEffect, useState, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { Bold, Italic, Link as LinkIcon } from 'lucide-react';

type SaveStatus = 'saved' | 'saving' | 'unsaved';

interface RichTextEditorProps {
  initialContent: string;
  onSave: (html: string) => Promise<void>;
  className?: string;
}

export function RichTextEditor({
  initialContent,
  onSave,
  className = '',
}: RichTextEditorProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const isSettingContent = useRef(false);

  const saveContent = useCallback(async (html: string) => {
    setSaveStatus('saving');
    try {
      await onSave(html);
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
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-500 underline',
        },
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'prose prose-sm prose-invert max-w-none focus:outline-none min-h-[60px] px-3 py-2',
      },
    },
    onUpdate: ({ editor }) => {
      // Skip save when we're programmatically setting content
      if (isSettingContent.current) return;
      setSaveStatus('unsaved');
      debouncedSave(editor.getHTML());
    },
  });

  // Update editor when initialContent changes externally (e.g., data loads)
  useEffect(() => {
    if (editor && initialContent && !editor.getText().trim()) {
      isSettingContent.current = true;
      editor.commands.setContent(initialContent);
      // Reset flag after the update cycle
      requestAnimationFrame(() => {
        isSettingContent.current = false;
      });
    }
  }, [editor, initialContent]);

  // Save on blur (user switches tabs, clicks away, etc.)
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
          margin-bottom: 1em;
        }
        .ProseMirror p:last-child {
          margin-bottom: 0;
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
