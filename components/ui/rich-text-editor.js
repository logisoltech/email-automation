"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyleKit } from "@tiptap/extension-text-style";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Undo2,
  Redo2,
} from "lucide-react";

/** Email-safe fonts (stacks that work in most clients). */
const FONT_OPTIONS = [
  { label: "Default", value: "" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', Helvetica, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
];

/**
 * Convert editor HTML to plain text for body_text / SMTP text part.
 * @param {string} html
 */
export function htmlToPlainText(html) {
  if (!html?.trim()) return "";
  if (typeof document !== "undefined") {
    const el = document.createElement("div");
    el.innerHTML = html;
    return (el.innerText || el.textContent || "")
      .replace(/\u00a0/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * @param {string} text
 */
function plainTextToHtml(text) {
  if (!text?.trim()) return "<p></p>";
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p>${paragraph
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br>")}</p>`
    )
    .join("");
}

/**
 * @param {{
 *   active?: boolean;
 *   onClick: () => void;
 *   title: string;
 *   children: import("react").ReactNode;
 * }} props
 */
function ToolbarButton({ active, onClick, title, children }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={
        active
          ? "inline-flex h-8 w-8 items-center justify-center rounded-lg bg-(--ink) text-(--on-ink)"
          : "inline-flex h-8 w-8 items-center justify-center rounded-lg text-(--body) transition hover:bg-(--ink)/8 hover:text-(--heading)"
      }
    >
      {children}
    </button>
  );
}

/**
 * @param {import("@tiptap/react").Editor} editor
 */
function currentFontValue(editor) {
  const active = FONT_OPTIONS.find(
    (font) => font.value && editor.isActive("textStyle", { fontFamily: font.value })
  );
  return active?.value || "";
}

/**
 * Word-style body editor for templates.
 *
 * @param {{
 *   label?: string;
 *   valueHtml?: string;
 *   valueText?: string;
 *   onChange: (next: { html: string; text: string }) => void;
 *   placeholder?: string;
 * }} props
 */
export function RichTextEditor({
  label = "Body",
  valueHtml = "",
  valueText = "",
  onChange,
  placeholder = "Write your email body…",
}) {
  const initial =
    valueHtml?.trim() ||
    (valueText?.trim() ? plainTextToHtml(valueText) : "<p></p>");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
      }),
      TextStyleKit.configure({
        backgroundColor: false,
        color: false,
        fontSize: false,
        lineHeight: false,
      }),
      Underline,
      TextAlign.configure({
        types: ["paragraph", "heading"],
        alignments: ["left", "center", "right"],
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: initial,
    editorProps: {
      attributes: {
        class:
          "tiptap min-h-50 px-3.5 py-3 text-sm text-(--heading) outline-none [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_em]:italic [&_u]:underline",
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      onChange({ html, text: htmlToPlainText(html) });
    },
  });

  if (!editor) {
    return (
      <div className="space-y-1.5">
        {label ? (
          <label className="block text-sm font-medium text-(--heading)">{label}</label>
        ) : null}
        <div className="h-50 animate-pulse rounded-xl border border-(--ink)/12 bg-(--ink)/4" />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {label ? (
        <label className="block text-sm font-medium text-(--heading)">{label}</label>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-(--ink)/12 bg-(--surface) shadow-[0_1px_0_var(--surface)_inset] focus-within:border-(--ink) focus-within:ring-2 focus-within:ring-(--ink)/10">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-(--ink)/10 bg-(--ink)/3 px-2 py-1.5">
          <select
            title="Font"
            aria-label="Font"
            value={currentFontValue(editor)}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              const value = e.target.value;
              if (!value) {
                editor.chain().focus().unsetFontFamily().run();
              } else {
                editor.chain().focus().setFontFamily(value).run();
              }
            }}
            className="mr-1 h-8 max-w-[9.5rem] rounded-lg border border-(--ink)/12 bg-(--surface) px-2 text-xs text-(--heading) outline-none focus:border-(--ink)"
          >
            {FONT_OPTIONS.map((font) => (
              <option
                key={font.label}
                value={font.value}
                style={font.value ? { fontFamily: font.value } : undefined}
              >
                {font.label}
              </option>
            ))}
          </select>

          <span className="mx-1 h-5 w-px bg-(--ink)/12" />

          <ToolbarButton
            title="Bold"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Italic"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Underline"
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className="h-3.5 w-3.5" />
          </ToolbarButton>

          <span className="mx-1 h-5 w-px bg-(--ink)/12" />

          <ToolbarButton
            title="Align left"
            active={editor.isActive({ textAlign: "left" })}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Align center"
            active={editor.isActive({ textAlign: "center" })}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Align right"
            active={editor.isActive({ textAlign: "right" })}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
          >
            <AlignRight className="h-3.5 w-3.5" />
          </ToolbarButton>

          <span className="mx-1 h-5 w-px bg-(--ink)/12" />

          <ToolbarButton
            title="Bullet list"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Numbered list"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolbarButton>

          <span className="mx-1 h-5 w-px bg-(--ink)/12" />

          <ToolbarButton title="Undo" onClick={() => editor.chain().focus().undo().run()}>
            <Undo2 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton title="Redo" onClick={() => editor.chain().focus().redo().run()}>
            <Redo2 className="h-3.5 w-3.5" />
          </ToolbarButton>
        </div>
        <EditorContent editor={editor} />
      </div>
      <p className="text-xs text-(--muted-text)">
        Font, bold, italic, underline, alignment, and lists are saved with this template and included
        when you send.
      </p>
    </div>
  );
}
