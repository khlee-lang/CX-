import React from 'react';

interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({ name, className = '', ...props }) => {
  return (
    <span 
      className={`material-symbols-outlined ${className}`} 
      data-icon={name}
      {...props}
    >
      {name}
    </span>
  );
};
