import { useState, useRef, useEffect } from 'react';
import './MonthPicker.css';

interface MonthPickerProps {
  value: string; // Format: YYYY-MM
  onChange: (value: string) => void;
  minDate?: string; // Optional minimum month (YYYY-MM)
  maxDate?: string; // Optional maximum month (YYYY-MM)
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function MonthPicker({ value, onChange, minDate, maxDate }: MonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => {
    const [year] = value.split('-');
    return parseInt(year);
  });
  const pickerRef = useRef<HTMLDivElement>(null);

  const [selectedYear, selectedMonth] = value.split('-').map(Number);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const formatDisplayValue = (val: string): string => {
    const [year, month] = val.split('-');
    return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
  };

  const handleMonthClick = (month: number) => {
    const monthStr = String(month).padStart(2, '0');
    const newValue = `${viewYear}-${monthStr}`;

    // Check if month is within min/max bounds
    if (minDate && newValue < minDate) return;
    if (maxDate && newValue > maxDate) return;

    onChange(newValue);
    setIsOpen(false);
  };

  const isMonthDisabled = (month: number): boolean => {
    const monthStr = String(month).padStart(2, '0');
    const checkValue = `${viewYear}-${monthStr}`;

    if (minDate && checkValue < minDate) return true;
    if (maxDate && checkValue > maxDate) return true;
    return false;
  };

  const isMonthSelected = (month: number): boolean => {
    return viewYear === selectedYear && month === selectedMonth;
  };

  const isCurrentMonth = (month: number): boolean => {
    const now = new Date();
    return viewYear === now.getFullYear() && month === now.getMonth() + 1;
  };

  const isFutureMonth = (month: number): boolean => {
    const now = new Date();
    const checkDate = new Date(viewYear, month - 1);
    const currentDate = new Date(now.getFullYear(), now.getMonth());
    return checkDate > currentDate;
  };

  const handlePrevYear = () => setViewYear(prev => prev - 1);
  const handleNextYear = () => setViewYear(prev => prev + 1);

  return (
    <div className="month-picker" ref={pickerRef}>
      <button
        type="button"
        className="month-picker-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span>{formatDisplayValue(value)}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="month-picker-chevron">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="month-picker-popup">
          <div className="month-picker-header">
            <button
              type="button"
              className="month-picker-nav-btn"
              onClick={handlePrevYear}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className="month-picker-year">{viewYear}</span>
            <button
              type="button"
              className="month-picker-nav-btn"
              onClick={handleNextYear}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          <div className="month-picker-grid">
            {MONTH_NAMES.map((monthName, idx) => {
              const monthNumber = idx + 1;
              const disabled = isMonthDisabled(monthNumber);
              const selected = isMonthSelected(monthNumber);
              const current = isCurrentMonth(monthNumber);
              const future = isFutureMonth(monthNumber);

              return (
                <button
                  key={monthName}
                  type="button"
                  className={`month-picker-month ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${current ? 'current' : ''} ${future ? 'future' : ''}`}
                  onClick={() => !disabled && handleMonthClick(monthNumber)}
                  disabled={disabled}
                >
                  {monthName}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
