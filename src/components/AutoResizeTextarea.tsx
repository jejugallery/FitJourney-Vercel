import React, { useEffect, useRef, type TextareaHTMLAttributes } from 'react';

interface AutoResizeTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  // Can be extended with custom properties if needed
}

export const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = ({ style, value, onChange, ...props }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      {...props}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        ...style,
        resize: 'none',
        overflowY: 'hidden',
      }}
    />
  );
};
