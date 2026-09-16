import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { Bold, Italic, List, ListOrdered, Strikethrough, Underline } from "lucide-react";
import { useT } from "../lib/i18n/context";
import { notesToHtml } from "../lib/richText";

type RichTextEditorProps = {
  disabled?: boolean;
  /* false = solo lectura, sin barra de herramientas (detalle de una entrada). */
  editable?: boolean;
  onChange?: (html: string) => void;
  placeholder?: string;
  value: string;
};

/* Editor generico de texto enriquecido (Tiptap por debajo), con barra propia en vez de
   la UI de fabrica de la libreria, que no pegaria con el resto de la app. Deliberadamente
   corto de opciones: negrita, cursiva, subrayado, tachado y listas — nada de titulos,
   citas, codigo ni enlaces, que no pedia el diario de trading que esto sustituye. */
export function RichTextEditor({ disabled = false, editable = true, onChange, placeholder, value }: RichTextEditorProps) {
  const t = useT();
  const isInteractive = editable && !disabled;
  const editor = useEditor({
    editable: isInteractive,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        link: false,
      }),
      Placeholder.configure({ placeholder: placeholder || "" }),
    ],
    content: notesToHtml(value),
    onUpdate: ({ editor: current }) => onChange?.(current.getHTML()),
    /* Sin esto el estado activo de los botones (negrita pulsada, etc.) no se
       actualizaba al mover el cursor: v3 dejo de re-renderizar en cada transaccion por
       defecto. La barra es el unico sitio que depende de ese estado, asi que el coste
       de volver al comportamiento anterior aqui es minimo. */
    shouldRerenderOnTransaction: true,
  });

  /* Sincroniza SOLO cuando el cambio viene de fuera (se cambia de entrada, o se resetea
     el formulario) — comparar contra editor.getHTML() evita pisar la escritura propia:
     onUpdate ya deja value igual al contenido del editor en cuanto el usuario teclea. */
  useEffect(() => {
    const next = notesToHtml(value);
    if (editor.getHTML() !== next) editor.commands.setContent(next, { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, value]);

  useEffect(() => {
    editor.setEditable(isInteractive);
  }, [editor, isInteractive]);

  return (
    <div className={`rich-text-editor ${editable ? "" : "is-readonly"}`}>
      {editable && <RichTextToolbar disabled={disabled} editor={editor} t={t} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function RichTextToolbar({ disabled, editor, t }: { disabled: boolean; editor: Editor; t: ReturnType<typeof useT> }) {
  const buttons: Array<{ active: boolean; icon: typeof Bold; label: string; onClick: () => void }> = [
    { active: editor.isActive("bold"), icon: Bold, label: t("richText.bold"), onClick: () => editor.chain().focus().toggleBold().run() },
    { active: editor.isActive("italic"), icon: Italic, label: t("richText.italic"), onClick: () => editor.chain().focus().toggleItalic().run() },
    {
      active: editor.isActive("underline"),
      icon: Underline,
      label: t("richText.underline"),
      onClick: () => editor.chain().focus().toggleUnderline().run(),
    },
    { active: editor.isActive("strike"), icon: Strikethrough, label: t("richText.strike"), onClick: () => editor.chain().focus().toggleStrike().run() },
    {
      active: editor.isActive("bulletList"),
      icon: List,
      label: t("richText.bulletList"),
      onClick: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      active: editor.isActive("orderedList"),
      icon: ListOrdered,
      label: t("richText.orderedList"),
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
    },
  ];

  return (
    <div className="rich-text-toolbar" role="toolbar">
      {buttons.map(({ active, icon: Icon, label, onClick }) => (
        <button
          aria-label={label}
          aria-pressed={active}
          className={active ? "active" : ""}
          disabled={disabled}
          key={label}
          onClick={onClick}
          title={label}
          type="button"
        >
          <Icon size={15} strokeWidth={2.2} />
        </button>
      ))}
    </div>
  );
}
