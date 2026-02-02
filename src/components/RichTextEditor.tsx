'use client';

import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { useCallback, useEffect } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  autoFocus?: boolean;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  accentColor?: 'blue' | 'red' | 'emerald';
}

interface MenuBarProps {
  editor: Editor | null;
  accentColor: 'blue' | 'red' | 'emerald';
}

function MenuBar({ editor, accentColor }: MenuBarProps) {
  if (!editor) {
    return null;
  }

  const activeColorClasses = {
    blue: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
    red: 'bg-red-500/20 text-red-600 dark:text-red-400',
    emerald: 'bg-emerald-500/20 text-emerald-500 dark:text-emerald-400',
  };

  const activeClass = activeColorClasses[accentColor];
  const inactiveClass = 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50';

  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    // cancelled
    if (url === null) {
      return;
    }

    // empty
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    // update link
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/30 rounded-t-xl">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={`p-1.5 rounded-md transition-colors ${
          editor.isActive('bold') ? activeClass : inactiveClass
        }`}
        title="Bold"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={`p-1.5 rounded-md transition-colors ${
          editor.isActive('italic') ? activeClass : inactiveClass
        }`}
        title="Italic"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 4h4m-2 0v16m4-16h-4m-4 16h8" transform="skewX(-10)" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        disabled={!editor.can().chain().focus().toggleUnderline().run()}
        className={`p-1.5 rounded-md transition-colors ${
          editor.isActive('underline') ? activeClass : inactiveClass
        }`}
        title="Underline"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v7a5 5 0 0010 0V4M5 20h14" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        className={`p-1.5 rounded-md transition-colors ${
          editor.isActive('strike') ? activeClass : inactiveClass
        }`}
        title="Strikethrough"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5c-2.5 0-4 1.5-4 3.5S10 12 12 12s4 1 4 3.5-1.5 3.5-4 3.5" />
        </svg>
      </button>

      <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-1.5 rounded-md transition-colors ${
          editor.isActive('bulletList') ? activeClass : inactiveClass
        }`}
        title="Bullet List"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h.01M4 12h.01M4 18h.01M8 6h12M8 12h12M8 18h12" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`p-1.5 rounded-md transition-colors ${
          editor.isActive('orderedList') ? activeClass : inactiveClass
        }`}
        title="Numbered List"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h.01M4 12h.01M4 18h.01M8 6h12M8 12h12M8 18h12" />
          <text x="2" y="8" fontSize="6" fill="currentColor" className="font-mono">1</text>
          <text x="2" y="14" fontSize="6" fill="currentColor" className="font-mono">2</text>
          <text x="2" y="20" fontSize="6" fill="currentColor" className="font-mono">3</text>
        </svg>
      </button>

      <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

      <button
        type="button"
        onClick={setLink}
        className={`p-1.5 rounded-md transition-colors ${
          editor.isActive('link') ? activeClass : inactiveClass
        }`}
        title="Add Link"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      </button>

      <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={`p-1.5 rounded-md transition-colors ${
          editor.isActive('blockquote') ? activeClass : inactiveClass
        }`}
        title="Quote"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={`p-1.5 rounded-md transition-colors ${
          editor.isActive('codeBlock') ? activeClass : inactiveClass
        }`}
        title="Code Block"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      </button>
    </div>
  );
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = '',
  className = '',
  minHeight = '100px',
  autoFocus = false,
  onKeyDown,
  accentColor = 'blue',
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        horizontalRule: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-500 hover:text-blue-600 underline cursor-pointer',
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      Underline,
    ],
    content,
    editorProps: {
      attributes: {
        class: `prose prose-sm dark:prose-invert max-w-none focus:outline-none px-4 py-3`,
        style: `min-height: ${minHeight}`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    autofocus: autoFocus,
    immediatelyRender: false,
  });

  // Handle external content changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const borderColorClasses = {
    blue: 'focus-within:ring-blue-500/20 focus-within:border-blue-400',
    red: 'focus-within:ring-red-500/20 focus-within:border-red-400',
    emerald: 'focus-within:ring-emerald-500/20 focus-within:border-emerald-400',
  };

  return (
    <div
      className={`border border-slate-200 dark:border-slate-700/80 rounded-xl focus-within:outline-none focus-within:ring-2 transition-all bg-white dark:bg-slate-900/70 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${borderColorClasses[accentColor]} ${className}`}
      onKeyDown={onKeyDown}
    >
      <MenuBar editor={editor} accentColor={accentColor} />
      <EditorContent 
        editor={editor} 
        className="rich-text-editor"
      />
      <style jsx global>{`
        .rich-text-editor .ProseMirror {
          min-height: ${minHeight};
          outline: none !important;
          box-shadow: none !important;
        }
        .rich-text-editor .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #94a3b8;
          pointer-events: none;
          height: 0;
        }
        .rich-text-editor .ProseMirror:focus,
        .rich-text-editor .ProseMirror:focus-visible,
        .rich-text-editor .ProseMirror *:focus,
        .rich-text-editor .ProseMirror *:focus-visible {
          outline: none !important;
          box-shadow: none !important;
        }
        .rich-text-editor:focus-within .ProseMirror {
          outline: none !important;
        }
        .rich-text-editor .ProseMirror ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        .rich-text-editor .ProseMirror ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        .rich-text-editor .ProseMirror li {
          margin: 0.25rem 0;
        }
        .rich-text-editor .ProseMirror blockquote {
          border-left: 3px solid #e2e8f0;
          padding-left: 1rem;
          margin: 0.5rem 0;
          color: #64748b;
        }
        .dark .rich-text-editor .ProseMirror blockquote {
          border-left-color: #475569;
          color: #94a3b8;
        }
        .rich-text-editor .ProseMirror pre {
          background: #f1f5f9;
          border-radius: 0.5rem;
          padding: 0.75rem 1rem;
          font-family: ui-monospace, monospace;
          font-size: 0.875rem;
          margin: 0.5rem 0;
          overflow-x: auto;
        }
        .dark .rich-text-editor .ProseMirror pre {
          background: #1e293b;
        }
        .rich-text-editor .ProseMirror code {
          background: #f1f5f9;
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
          font-family: ui-monospace, monospace;
          font-size: 0.875rem;
        }
        .dark .rich-text-editor .ProseMirror code {
          background: #1e293b;
        }
        .rich-text-editor .ProseMirror p {
          margin: 0.25rem 0;
        }
        .rich-text-editor .ProseMirror strong {
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}

// Simpler display component for rendering rich text content
interface RichTextDisplayProps {
  content: string;
  className?: string;
}

export function RichTextDisplay({ content, className = '' }: RichTextDisplayProps) {
  // Check if content looks like HTML (has tags) or is plain text
  const isHTML = content.includes('<') && content.includes('>');
  
  if (!isHTML) {
    // Plain text - render with whitespace preserved
    return (
      <div className={`whitespace-pre-wrap ${className}`}>
        {content}
      </div>
    );
  }

  return (
    <div 
      className={`rich-text-display prose prose-sm dark:prose-invert max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
