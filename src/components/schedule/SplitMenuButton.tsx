import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

type IconComponent = React.ComponentType<{ className?: string }>;

export interface MenuOption<T extends string> {
  value: T;
  label: string;
  Icon?: IconComponent;
}

interface Props<T extends string> {
  /** Text of the main button, e.g. "Export as JSON". */
  label: string;
  title: string;
  Icon: IconComponent;
  /** Accessible name of the chevron button that opens the menu. */
  menuLabel: string;
  options: MenuOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  onClick: () => void;
  variant: "primary" | "neutral";
  menuAlign: "left" | "right";
  menuWidthClass: string;
}

const VARIANT_CLASSES = {
  primary: {
    main: "bg-primary text-white hover:bg-primary-dark",
    toggle: "bg-primary text-white hover:bg-primary-dark border-primary-light",
  },
  neutral: {
    main: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    toggle: "bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300",
  },
};

/**
 * Closes an open dropdown when clicking outside of the given container ref.
 */
function useCloseOnOutsideClick(
  ref: React.RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!isOpen) return undefined;

    /** Closes the dropdown when a click lands outside its container. */
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, ref, onClose]);
}

/**
 * A main action button paired with a chevron that opens a menu of alternative
 * options (e.g. which format to export as); picking one updates the main button.
 */
export default function SplitMenuButton<T extends string>({
  label,
  title,
  Icon,
  menuLabel,
  options,
  selected,
  onSelect,
  onClick,
  variant,
  menuAlign,
  menuWidthClass,
}: Readonly<Props<T>>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useCloseOnOutsideClick(containerRef, isOpen, () => setIsOpen(false));
  const classes = VARIANT_CLASSES[variant];

  /** Selects an option and closes the menu. */
  const select = (value: T) => {
    onSelect(value);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-flex" ref={containerRef}>
      <button
        onClick={onClick}
        className={`flex items-center gap-2 pl-4 pr-3 py-2 rounded-l-md ${classes.main}`}
        title={title}
      >
        <Icon className="w-5 h-5" />
        {label}
      </button>
      <button
        onClick={() => setIsOpen((open) => !open)}
        className={`flex items-center px-2 py-2 rounded-r-md border-l ${classes.toggle}`}
        aria-label={menuLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <ChevronDown className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          role="menu"
          className={`absolute ${menuAlign === "left" ? "left-0" : "right-0"} top-full mt-1 ${menuWidthClass} bg-white border border-gray-200 rounded-md shadow-lg z-10 overflow-hidden`}
        >
          {options.map((option) => (
            <MenuItem
              key={option.value}
              option={option}
              isSelected={option.value === selected}
              onSelect={select}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** One option in the SplitMenuButton's menu, highlighted when selected. */
function MenuItem<T extends string>({
  option,
  isSelected,
  onSelect,
}: Readonly<{
  option: MenuOption<T>;
  isSelected: boolean;
  onSelect: (value: T) => void;
}>) {
  const { Icon } = option;
  return (
    <button
      role="menuitem"
      onClick={() => onSelect(option.value)}
      className={`w-full flex items-center gap-2 text-left px-4 py-2 text-sm hover:bg-gray-100 ${
        isSelected ? "font-semibold text-primary" : "text-gray-700"
      }`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {option.label}
    </button>
  );
}
