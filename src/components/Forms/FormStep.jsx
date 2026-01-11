/**
 * FormStep Component
 * Wrapper for multi-step form navigation with progress indicator
 */

import Button from '../Common/Button';

const FormStep = ({
  children,
  currentStep,
  totalSteps,
  title,
  description,
  onNext,
  onBack,
  onSubmit,
  nextLabel = 'Next',
  backLabel = 'Back',
  submitLabel = 'Submit',
  isNextDisabled = false,
  isLoading = false,
  showSubmit = false,
}) => {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header with Progress */}
      <div className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 p-4">
        <div className="max-w-2xl mx-auto">
          {/* Progress Bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1 flex items-center">
              {Array.from({ length: totalSteps }, (_, i) => (
                <div key={i} className="flex items-center">
                  {/* Step Circle */}
                  <div
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all
                      ${i + 1 < currentStep
                        ? 'bg-emerald-500 text-white'
                        : i + 1 === currentStep
                        ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400'
                        : 'bg-slate-700 text-slate-400'
                      }
                    `}
                  >
                    {i + 1 < currentStep ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>

                  {/* Connector Line */}
                  {i < totalSteps - 1 && (
                    <div
                      className={`
                        w-8 sm:w-12 h-1 mx-1 rounded transition-all
                        ${i + 1 < currentStep ? 'bg-emerald-500' : 'bg-slate-700'}
                      `}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Step Counter */}
            <span className="text-sm text-slate-400 ml-4">
              {currentStep} of {totalSteps}
            </span>
          </div>

          {/* Title and Description */}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100">{title}</h1>
            {description && (
              <p className="text-sm text-slate-400 mt-1">{description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 sm:p-6">
          {children}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="bg-slate-800/50 backdrop-blur-xl border-t border-slate-700/50 p-4">
        <div className="max-w-2xl mx-auto flex gap-3">
          {/* Back Button */}
          {currentStep > 1 && (
            <Button
              variant="outline"
              size="lg"
              onClick={onBack}
              disabled={isLoading}
              className="flex-1 sm:flex-none sm:w-32"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {backLabel}
            </Button>
          )}

          {/* Next/Submit Button */}
          {showSubmit ? (
            <Button
              variant="primary"
              size="lg"
              onClick={onSubmit}
              disabled={isNextDisabled || isLoading}
              loading={isLoading}
              fullWidth={currentStep === 1}
              className={currentStep > 1 ? 'flex-1' : ''}
            >
              {submitLabel}
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              onClick={onNext}
              disabled={isNextDisabled || isLoading}
              fullWidth={currentStep === 1}
              className={currentStep > 1 ? 'flex-1' : ''}
            >
              {nextLabel}
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// Input Field Component for forms
export const FormInput = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  hint,
  required = false,
  disabled = false,
  className = '',
  ...props
}) => {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={name} className="block text-sm font-medium text-slate-300 mb-2">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`
          w-full px-4 py-3 bg-slate-900/50 border rounded-lg text-slate-100 
          placeholder-slate-500 focus:outline-none focus:ring-2 transition-colors
          ${error
            ? 'border-red-500/50 focus:ring-red-500/30'
            : 'border-slate-700 focus:ring-emerald-500/30 focus:border-emerald-500/50'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        {...props}
      />
      {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
      {hint && !error && <p className="mt-1.5 text-sm text-slate-500">{hint}</p>}
    </div>
  );
};

// Textarea Component
export const FormTextarea = ({
  label,
  name,
  value,
  onChange,
  placeholder,
  error,
  hint,
  required = false,
  disabled = false,
  rows = 4,
  className = '',
  ...props
}) => {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={name} className="block text-sm font-medium text-slate-300 mb-2">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <textarea
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className={`
          w-full px-4 py-3 bg-slate-900/50 border rounded-lg text-slate-100 
          placeholder-slate-500 focus:outline-none focus:ring-2 transition-colors resize-none
          ${error
            ? 'border-red-500/50 focus:ring-red-500/30'
            : 'border-slate-700 focus:ring-emerald-500/30 focus:border-emerald-500/50'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        {...props}
      />
      {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
      {hint && !error && <p className="mt-1.5 text-sm text-slate-500">{hint}</p>}
    </div>
  );
};

// Select Component
export const FormSelect = ({
  label,
  name,
  value,
  onChange,
  options,
  placeholder,
  error,
  hint,
  required = false,
  disabled = false,
  className = '',
  children,
}) => {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={name} className="block text-sm font-medium text-slate-300 mb-2">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`
          w-full px-4 py-3 bg-slate-900/50 border rounded-lg text-slate-100 
          focus:outline-none focus:ring-2 transition-colors
          ${error
            ? 'border-red-500/50 focus:ring-red-500/30'
            : 'border-slate-700 focus:ring-emerald-500/30 focus:border-emerald-500/50'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {children ? (
          children
        ) : (
          <>
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </>
        )}
      </select>
      {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
      {hint && !error && <p className="mt-1.5 text-sm text-slate-500">{hint}</p>}
    </div>
  );
};

// Radio Group Component
export const FormRadioGroup = ({
  label,
  name,
  value,
  onChange,
  options,
  error,
  required = false,
  className = '',
}) => {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-slate-300 mb-3">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`
              flex items-start p-4 rounded-lg border cursor-pointer transition-all
              ${value === option.value
                ? 'bg-emerald-500/10 border-emerald-500/50'
                : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
              }
            `}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <div
              className={`
                w-5 h-5 rounded-full border-2 mr-3 mt-0.5 flex items-center justify-center flex-shrink-0
                ${value === option.value
                  ? 'border-emerald-500 bg-emerald-500'
                  : 'border-slate-500'
                }
              `}
            >
              {value === option.value && (
                <div className="w-2 h-2 rounded-full bg-white" />
              )}
            </div>
            <div>
              <p className="text-slate-100 font-medium">{option.label}</p>
              {option.description && (
                <p className="text-sm text-slate-400 mt-0.5">{option.description}</p>
              )}
            </div>
          </label>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
};

export default FormStep;
