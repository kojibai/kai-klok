// src/components/KaiRealms/styles.ts

const styles = {
  portalWrapper: 'flex flex-col items-center justify-center w-full h-full p-6 bg-black/90',

  portalCard: 'bg-[#000022] rounded-xl shadow-xl p-8 w-full max-w-md text-center',
  title: 'text-2xl font-bold text-cyan-300 mb-2',
  subtitle: 'text-sm text-blue-200 mb-4',

  fileInput: 'block w-full text-sm text-white file:bg-cyan-700 file:text-white file:px-4 file:py-2 file:rounded-full file:border-none file:cursor-pointer',

  errorText: 'text-red-500 text-sm mt-2',

  previewContainer: 'mt-6 flex flex-col items-center justify-center gap-2',
  metaText: 'text-cyan-100 text-sm font-mono tracking-tight',

  enterButton: 'mt-4 px-6 py-2 bg-cyan-500 text-white font-bold rounded-lg shadow-md hover:bg-cyan-600 transition',

  canvasWrapper: 'relative w-full h-auto flex flex-col items-center justify-center',

  inventoryPanel: 'absolute top-4 right-4 bg-black/70 p-4 rounded-xl text-white text-sm w-[240px] shadow-md',

  kasinoPanel: 'mt-6 p-6 bg-gradient-to-br from-[#001133] to-[#002244] rounded-lg text-white shadow-lg text-center',

  missionPanel: 'mt-4 p-4 bg-black/80 rounded-xl text-center text-cyan-300 text-sm font-mono',

  closeButton: 'mt-4 text-sm text-red-400 underline cursor-pointer',
};

export default styles;
