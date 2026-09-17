
import React from 'react';
import { STATUS_COLORS, STATUS_LABELS, LEVEL_COLORS } from '../constants';
import { RequestStatus, RequestLevel } from '../types';
import { Clock, AlertTriangle, Flame, AlertOctagon } from 'lucide-react';

export const Card: React.FC<{ children: React.ReactNode; className?: string; title?: string; action?: React.ReactNode }> = ({ children, className = '', title, action }) => (
  <div className={`bg-white rounded-2xl shadow-card border border-gray-200/60 ${className}`}>
    {(title || action) && (
      <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
        {title && <h3 className="font-bold text-gray-900 text-base md:text-lg tracking-tight">{title}</h3>}
        {action && <div>{action}</div>}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

export const Badge: React.FC<{ status?: RequestStatus; level?: RequestLevel; className?: string }> = ({ status, level, className = '' }) => {
  if (status) {
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wide border shadow-sm ${STATUS_COLORS[status]} ${className}`}>
        {STATUS_LABELS[status]}
      </span>
    );
  }
  if (level) {
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wide text-white shadow-sm ${LEVEL_COLORS[level]} ${className}`}>
        {level}
      </span>
    );
  }
  return null;
};

// NEW: Powerful Deadline Display
export const DeadlineDisplay: React.FC<{ dueAt?: string | null; compact?: boolean }> = ({ dueAt, compact = false }) => {
    if (!dueAt) return null;

    const now = new Date();
    const due = new Date(dueAt);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Status Logic
    let status: 'CRITICAL' | 'WARNING' | 'SAFE' | 'OVERDUE' = 'SAFE';
    if (diffDays < 0) status = 'OVERDUE';
    else if (diffDays <= 1) status = 'CRITICAL';
    else if (diffDays <= 3) status = 'WARNING';

    // Visual Config
    const config = {
        OVERDUE: { bg: 'bg-gray-800', text: 'text-white', border: 'border-gray-900', icon: <AlertOctagon size={compact?14:18}/>, label: 'VENCIDO' },
        CRITICAL: { bg: 'bg-red-600', text: 'text-white', border: 'border-red-700', icon: <Flame size={compact?14:18} className="animate-pulse"/>, label: 'URGENTE' },
        WARNING: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200', icon: <AlertTriangle size={compact?14:18}/>, label: 'ATENÇÃO' },
        SAFE: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: <Clock size={compact?14:18}/>, label: 'NO PRAZO' }
    };

    const style = config[status];
    const daysLabel = Math.abs(diffDays) === 1 ? 'dia' : 'dias';
    const text = diffDays < 0 ? `Atrasado há ${Math.abs(diffDays)} ${daysLabel}` : (diffDays === 0 ? 'Vence HOJE' : `Vence em ${diffDays} ${daysLabel}`);

    if (compact) {
        return (
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-extrabold border ${style.bg} ${style.text} ${style.border}`}>
                {style.icon} {text}
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-sm ${style.bg} ${style.border} ${style.text}`}>
            <div className={`p-2 rounded-full bg-white/20 backdrop-blur-sm ${status === 'CRITICAL' ? 'animate-bounce' : ''}`}>
                {style.icon}
            </div>
            <div>
                <p className="text-[10px] font-black opacity-80 uppercase tracking-widest mb-0.5">{style.label}</p>
                <p className="text-sm font-bold leading-none">{text}</p>
            </div>
        </div>
    );
};

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost' }> = ({ children, variant = 'primary', className = '', ...props }) => {
  const baseStyle = "inline-flex items-center justify-center px-5 py-3 text-sm font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";
  
  const variants = {
    primary: "border-transparent text-white bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-500/20",
    secondary: "border-transparent text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200",
    danger: "border-transparent text-white bg-red-600 hover:bg-red-700 shadow-md shadow-red-500/20",
    outline: "border border-gray-300 text-gray-700 bg-white hover:bg-gray-50",
    ghost: "border-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900 shadow-none",
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, className = '', ...props }) => (
  <div className="mb-4">
    {label && <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">{label}</label>}
    <input 
      className={`block w-full rounded-xl border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-3.5 border shadow-sm transition-all ${className}`} 
      {...props} 
    />
  </div>
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string, options: { value: string, label: string }[] }> = ({ label, options, className = '', ...props }) => (
  <div className="mb-4">
    {label && <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">{label}</label>}
    <select 
      className={`block w-full rounded-xl border-gray-300 bg-white text-gray-900 focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-3.5 border shadow-sm transition-all appearance-none ${className}`} 
      {...props}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value} className="text-gray-900">{opt.label}</option>
      ))}
    </select>
  </div>
);

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }> = ({ label, className = '', ...props }) => (
  <div className="mb-4">
    {label && <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">{label}</label>}
    <textarea 
      className={`block w-full rounded-xl border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-3.5 border shadow-sm transition-all ${className}`} 
      rows={4}
      {...props} 
    />
  </div>
);
