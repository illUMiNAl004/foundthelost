/**
 * Card Component
 * Glassmorphism card with variants and interactive states
 */

import { forwardRef } from 'react';

const variants = {
  default: 'bg-slate-800/50 border-slate-700/50',
  elevated: 'bg-slate-800/70 border-slate-700/50 shadow-xl',
  outlined: 'bg-transparent border-slate-700',
  interactive:
    'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800/70 hover:border-slate-600/50 cursor-pointer transition-all duration-200',
  success: 'bg-emerald-500/10 border-emerald-500/30',
  warning: 'bg-amber-500/10 border-amber-500/30',
  danger: 'bg-red-500/10 border-red-500/30',
  info: 'bg-sky-500/10 border-sky-500/30',
};

const Card = forwardRef(
  (
    {
      children,
      variant = 'default',
      padding = 'default',
      className = '',
      onClick,
      ...props
    },
    ref
  ) => {
    const paddingStyles = {
      none: '',
      sm: 'p-3',
      default: 'p-4',
      lg: 'p-6',
      xl: 'p-8',
    };

    return (
      <div
        ref={ref}
        onClick={onClick}
        className={`
          backdrop-blur-xl rounded-xl border
          ${variants[variant]}
          ${paddingStyles[padding]}
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

// Named export for Card
export { Card };

// Card Header sub-component
export const CardHeader = ({ children, className = '' }) => (
  <div className={`mb-4 ${className}`}>{children}</div>
);

// Card Title sub-component
export const CardTitle = ({ children, className = '' }) => (
  <h3 className={`text-lg font-semibold text-slate-100 ${className}`}>{children}</h3>
);

// Card Description sub-component
export const CardDescription = ({ children, className = '' }) => (
  <p className={`text-sm text-slate-400 mt-1 ${className}`}>{children}</p>
);

// Card Content sub-component
export const CardContent = ({ children, className = '' }) => (
  <div className={className}>{children}</div>
);

// Card Footer sub-component
export const CardFooter = ({ children, className = '' }) => (
  <div className={`mt-4 pt-4 border-t border-slate-700/50 ${className}`}>{children}</div>
);

export default Card;
