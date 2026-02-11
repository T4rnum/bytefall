import React from 'react'
import styles from './CharPicker.module.scss'
import clsx from 'clsx'

interface CharPickerProps {
  onSelect: (char: string) => void
  activeChar: string
  onClose: () => void
}

const CHAR_GROUPS = [
  {
    label: 'Blocks',
    chars: ['█', '▓', '▒', '░', '■', '□', '▪', '▫']
  },
  {
    label: 'Lines',
    chars: ['─', '│', '┌', '┐', '└', '┘', '├', '┤', '┬', '┴', '┼']
  },
  {
    label: 'Shapes',
    chars: ['●', '○', '▲', '▼', '◄', '►', '◆', '◇']
  },
  {
    label: 'Misc',
    chars: ['★', '☆', '❤', '☂', '☀', '♪', '♫', '⚓']
  },
  {
    label: 'Basic',
    chars: ['@', '#', '$', '%', '&', '*', '+', '=', '?', '!']
  }
]

export const CharPicker: React.FC<CharPickerProps> = ({ onSelect, activeChar, onClose }) => {
  // Close when clicking outside logic should be handled by parent or overlay
  // But for now, we'll just render the picker

  return (
    <div className={styles.pickerContainer}>
      <div 
        className={clsx(styles.charBtn, activeChar === ' ' && styles.active)}
        onClick={() => onSelect(' ')}
        style={{ gridColumn: '1 / -1', width: '100%' }}
        title="Space (Eraser)"
      >
        [SPACE]
      </div>

      {CHAR_GROUPS.map(group => (
        <React.Fragment key={group.label}>
          <div className={styles.categoryLabel}>{group.label}</div>
          {group.chars.map(char => (
            <button
              key={char}
              className={clsx(styles.charBtn, activeChar === char && styles.active)}
              onClick={() => onSelect(char)}
            >
              {char}
            </button>
          ))}
        </React.Fragment>
      ))}
    </div>
  )
}
