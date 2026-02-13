import React, { useState, useRef, useEffect } from 'react'
import styles from './CustomSelect.module.scss'
import { ChevronDown } from 'lucide-react'
import clsx from 'clsx'

interface Option {
  value: string
  label: string
}

interface CustomSelectProps {
  options: Option[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ options, value, onChange, className }) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const selectedOption = options.find(o => o.value === value) || options[0]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={clsx(styles.selectContainer, className, isOpen && styles.open)} ref={containerRef}>
      <div className={styles.selectedArea} onClick={() => setIsOpen(!isOpen)}>
        <span className={styles.label}>{selectedOption.label}</span>
        <ChevronDown size={16} className={clsx(styles.chevron, isOpen && styles.rotated)} />
      </div>
      
      {isOpen && (
        <div className={styles.optionsList}>
          {options.map(option => (
            <div 
              key={option.value} 
              className={clsx(styles.option, option.value === value && styles.selected)}
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
