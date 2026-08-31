import React, { useEffect } from 'react';

interface ToastProps {
  message: string | null;
  onClose: () => void;
  type?: 'success' | 'info' | 'error';
}

export const Toast: React.FC<ToastProps> = ({ message, onClose, type = 'success' }) => {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  const getStyle = () => {
    switch (type) {
      case 'error':
        return 'bg-[#ba1a1a] text-white border-[#93000a]';
      case 'info':
        return 'bg-[#004d99] text-white border-[#001b3d]';
      default:
        return 'bg-[#1b6d24] text-white border-[#002204]';
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-200">
      <div
        className={`px-4 py-3 rounded-xl border shadow-xl flex items-center gap-3 text-[14px] font-medium ${getStyle()}`}
      >
        <span className="material-symbols-outlined text-[20px]">
          {type === 'error' ? 'error' : type === 'info' ? 'info' : 'check_circle'}
        </span>
        <span>{message}</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-2 hover:opacity-80 p-0.5 rounded focus:outline-none"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    </div>
  );
};
