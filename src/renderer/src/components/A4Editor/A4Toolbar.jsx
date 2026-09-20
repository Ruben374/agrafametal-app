export default function A4Toolbar({ applyCmd, inserirSimbolo }) {
  return (
    <div className="flex flex-wrap items-center gap-1 border border-gray-200 bg-gray-50 rounded-t-md p-1.5 shadow-sm print:hidden">
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => applyCmd('bold')}
        className="w-8 h-8 rounded text-gray-600 hover:bg-gray-200 hover:text-blue-700 transition"
      >
        <i className="fa-solid fa-bold"></i>
      </button>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => applyCmd('italic')}
        className="w-8 h-8 rounded text-gray-600 hover:bg-gray-200 hover:text-blue-700 transition"
      >
        <i className="fa-solid fa-italic"></i>
      </button>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => applyCmd('underline')}
        className="w-8 h-8 rounded text-gray-600 hover:bg-gray-200 hover:text-blue-700 transition"
      >
        <i className="fa-solid fa-underline"></i>
      </button>
      <div className="w-px h-5 bg-gray-300 mx-1"></div>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => applyCmd('justifyLeft')}
        className="w-8 h-8 rounded text-gray-600 hover:bg-gray-200 hover:text-blue-700 transition"
      >
        <i className="fa-solid fa-align-left"></i>
      </button>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => applyCmd('justifyCenter')}
        className="w-8 h-8 rounded text-gray-600 hover:bg-gray-200 hover:text-blue-700 transition"
      >
        <i className="fa-solid fa-align-center"></i>
      </button>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => applyCmd('justifyRight')}
        className="w-8 h-8 rounded text-gray-600 hover:bg-gray-200 hover:text-blue-700 transition"
      >
        <i className="fa-solid fa-align-right"></i>
      </button>
      <div className="w-px h-5 bg-gray-300 mx-1"></div>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => applyCmd('insertUnorderedList')}
        className="w-8 h-8 rounded text-gray-600 hover:bg-gray-200 hover:text-blue-700 transition"
      >
        <i className="fa-solid fa-list-ul"></i>
      </button>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => applyCmd('insertOrderedList')}
        className="w-8 h-8 rounded text-gray-600 hover:bg-gray-200 hover:text-blue-700 transition"
      >
        <i className="fa-solid fa-list-ol"></i>
      </button>
      <div className="w-px h-5 bg-gray-300 mx-1"></div>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => inserirSimbolo('✓')}
        className="w-8 h-8 rounded text-green-600 hover:bg-gray-200 transition font-bold"
      >
        ✓
      </button>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => inserirSimbolo('➤')}
        className="w-8 h-8 rounded text-blue-600 hover:bg-gray-200 transition font-bold"
      >
        ➤
      </button>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => inserirSimbolo('✗')}
        className="w-8 h-8 rounded text-red-600 hover:bg-gray-200 transition font-bold"
      >
        ✗
      </button>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => applyCmd('indent')}
        className="w-8 h-8 rounded text-gray-600 hover:bg-gray-200 transition"
      >
        <i className="fa-solid fa-indent"></i>
      </button>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => applyCmd('outdent')}
        className="w-8 h-8 rounded text-gray-600 hover:bg-gray-200 transition"
      >
        <i className="fa-solid fa-outdent"></i>
      </button>
    </div>
  )
}
