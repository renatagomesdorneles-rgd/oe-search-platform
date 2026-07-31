import { useEffect, useRef } from 'react'

export default function RichTextEditor({ value, onChange, placeholder }) {
  const editorRef = useRef(null)
  const quillRef = useRef(null)

  useEffect(() => {
    if (quillRef.current) return // already initialized

    // Load Quill dynamically
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.snow.min.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.min.js'
    script.onload = () => {
      const quill = new window.Quill(editorRef.current, {
        theme: 'snow',
        placeholder: placeholder || '',
        modules: {
          toolbar: [
            ['bold', 'italic', 'underline'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            [{ header: [2, 3, false] }],
            ['clean'],
          ],
        },
      })

      // Set initial value
      if (value) {
        quill.root.innerHTML = value
      }

      // Emit changes as HTML
      quill.on('text-change', () => {
        onChange(quill.root.innerHTML)
      })

      quillRef.current = quill
    }
    document.head.appendChild(script)
  }, [])

  // Update content if value changes externally (e.g. on load)
  useEffect(() => {
    if (quillRef.current && value !== quillRef.current.root.innerHTML) {
      quillRef.current.root.innerHTML = value || ''
    }
  }, [value])

  return (
    <div style={{ border: '1px solid #CBD5E0', borderRadius: 8, overflow: 'hidden' }}>
      <div ref={editorRef} style={{ minHeight: 200, fontSize: 14, fontFamily: 'inherit' }} />
    </div>
  )
}
