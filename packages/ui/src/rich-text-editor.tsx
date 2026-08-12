"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  Heading2,
  Heading3,
  Upload,
  Sigma,
  Code2
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

interface RichTextEditorProps {
  label: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  required?: boolean;
}

export function RichTextEditor({
  label,
  value,
  onChange,
  placeholder = "Tulis konten...",
  minHeight = 130,
  required = false
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [codeMode, setCodeMode] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder })
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "wysiwyg-content",
        style: `min-height:${minHeight}px`
      }
    },
    onUpdate: ({ editor: currentEditor }) => onChange(currentEditor.getHTML())
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      editor.commands.setContent(value, false);
    }
  }, [editor, value]);

  if (!editor) return null;
  const activeEditor = editor;

  function setLink() {
    const previousUrl = activeEditor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Alamat tautan", previousUrl ?? "https://");
    if (url === null) return;
    if (!url) {
      activeEditor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    activeEditor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  function addImageUrl() {
    const url = window.prompt("URL gambar", "https://");
    if (url) activeEditor.chain().focus().setImage({ src: url, alt: "Gambar soal" }).run();
  }

  function addImageFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.alert("File harus berupa gambar.");
      return;
    }
    if (file.size > 1_000_000) {
      const proceed = window.confirm("Ukuran gambar lebih dari 1 MB. Tetap sisipkan?");
      if (!proceed) return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result ?? "");
      if (src) activeEditor.chain().focus().setImage({ src, alt: file.name }).run();
    };
    reader.readAsDataURL(file);
  }

  function addLatex() {
    const latex = window.prompt("Masukkan LaTeX. Contoh: \\frac{a}{b} atau x^2+2x+1", "\\frac{a}{b}");
    if (!latex) return;
    const display = window.confirm("Gunakan mode rumus besar/display?");
    const text = display ? `\\[${latex}\\]` : `\\(${latex}\\)`;
    activeEditor.chain().focus().insertContent(text).run();
  }

  function toggleCodeMode() {
    if (!codeMode) {
      onChange(activeEditor.getHTML());
    } else {
      activeEditor.commands.setContent(value || "", false);
    }
    setCodeMode((current) => !current);
  }

  const button = (labelText: string, active: boolean, action: () => void, icon: ReactNode) => (
    <button
      type="button"
      className={`editor-tool ${active ? "is-active" : ""}`}
      aria-label={labelText}
      title={labelText}
      onClick={action}
    >
      {icon}
    </button>
  );

  return (
    <label className="field-block">
      <span className="field-label">{label}{required ? " *" : ""}</span>
      <div className="wysiwyg-shell">
        <div className="wysiwyg-toolbar" role="toolbar" aria-label={`Peralatan editor ${label}`}>
          {button("Tebal", editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), <Bold size={16} />)}
          {button("Miring", editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), <Italic size={16} />)}
          {button("Garis bawah", editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run(), <UnderlineIcon size={16} />)}
          {button("Judul 2", editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), <Heading2 size={16} />)}
          {button("Judul 3", editor.isActive("heading", { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), <Heading3 size={16} />)}
          {button("Daftar", editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), <List size={16} />)}
          {button("Daftar bernomor", editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered size={16} />)}
          {button("Tautan", editor.isActive("link"), setLink, <LinkIcon size={16} />)}
          {button("Gambar dari komputer", false, () => fileInputRef.current?.click(), <Upload size={16} />)}
          {button("Gambar dari URL", false, addImageUrl, <ImageIcon size={16} />)}
          {button("LaTeX", false, addLatex, <Sigma size={16} />)}
          {button("Code HTML", codeMode, toggleCodeMode, <Code2 size={16} />)}
          {button("Sisipkan tabel", editor.isActive("table"), () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), <TableIcon size={16} />)}
          {button("Urungkan", false, () => editor.chain().focus().undo().run(), <Undo2 size={16} />)}
          {button("Ulangi", false, () => editor.chain().focus().redo().run(), <Redo2 size={16} />)}
        </div>
        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(event) => {
            addImageFile(event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
        {codeMode ? (
          <textarea
            className="wysiwyg-code-editor"
            aria-label={`Kode HTML ${label}`}
            spellCheck={false}
            value={value}
            style={{ minHeight }}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>
    </label>
  );
}
