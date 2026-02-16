import React from 'react'
import styles from './CharPicker.module.scss'
import clsx from 'clsx'
import { FONT_CHARS } from '../../modules/2d/fonts/fontCharset'

interface CharPickerProps {
  onSelect: (char: string) => void
  activeChar: string
  onClose: () => void
}

export const CharPicker: React.FC<CharPickerProps> = ({ onSelect, activeChar }) => {
  const visibleChars = FONT_CHARS.filter((char) => char !== ' ' && char !== '\u00A0')
  const ascii = visibleChars.filter((char) => {
    const code = char.codePointAt(0) ?? 0
    return code >= 33 && code <= 126
  })
  const digits = ascii.filter((char) => /[0-9]/.test(char))
  const upper = ascii.filter((char) => /[A-Z]/.test(char))
  const lower = ascii.filter((char) => /[a-z]/.test(char))
  const punctuation = ascii.filter((char) => !/[0-9A-Za-z]/.test(char))

  const cyrillicUpper = visibleChars.filter((char) => {
    const code = char.codePointAt(0) ?? 0
    return code === 0x0401 || (code >= 0x0410 && code <= 0x042F)
  })
  const cyrillicLower = visibleChars.filter((char) => {
    const code = char.codePointAt(0) ?? 0
    return code === 0x0451 || (code >= 0x0430 && code <= 0x044F)
  })
  const cyrillicExtended = visibleChars.filter((char) => {
    const code = char.codePointAt(0) ?? 0
    return code >= 0x0400 && code <= 0x04FF && !cyrillicUpper.includes(char) && !cyrillicLower.includes(char)
  })

  const mathSet = new Set('±×÷∂∆∏∑∕√∞∫≈≠≤≥'.split(''))
  const logicSet = new Set('¬'.split(''))
  const arrowSet = new Set('←↑→↓'.split(''))
  const specialSet = new Set('♥♦♠♣★☆♪❤'.split(''))

  const math = visibleChars.filter((char) => mathSet.has(char))
  const logic = visibleChars.filter((char) => logicSet.has(char))
  const arrows = visibleChars.filter((char) => arrowSet.has(char))
  const special = visibleChars.filter((char) => specialSet.has(char))

  const used = new Set([
    ...ascii,
    ...cyrillicUpper,
    ...cyrillicLower,
    ...cyrillicExtended,
    ...math,
    ...logic,
    ...arrows,
    ...special
  ])
  const extended = visibleChars.filter((char) => !used.has(char))

  return (
    <div className={styles.pickerContainer}>
      <div className={styles.specialChars}>
        <button 
          className={clsx(styles.charBtn, activeChar === '' && styles.active)}
          onClick={() => onSelect('')}
          title="Empty (Clear)"
        >
          ∅
        </button>
        <button 
          className={clsx(styles.charBtn, activeChar === ' ' && styles.active)}
          onClick={() => onSelect(' ')}
          title="Space (Dot)"
        >
          [SPACE]
        </button>
      </div>

      <div className={styles.categoryLabel}>Digits</div>
      {digits.map(char => (
        <button
          key={`d-${char}`}
          className={clsx(styles.charBtn, activeChar === char && styles.active)}
          onClick={() => onSelect(char)}
        >
          {char}
        </button>
      ))}

      <div className={styles.categoryLabel}>Uppercase</div>
      {upper.map(char => (
        <button
          key={`u-${char}`}
          className={clsx(styles.charBtn, activeChar === char && styles.active)}
          onClick={() => onSelect(char)}
        >
          {char}
        </button>
      ))}

      <div className={styles.categoryLabel}>Lowercase</div>
      {lower.map(char => (
        <button
          key={`l-${char}`}
          className={clsx(styles.charBtn, activeChar === char && styles.active)}
          onClick={() => onSelect(char)}
        >
          {char}
        </button>
      ))}

      <div className={styles.categoryLabel}>Punctuation</div>
      {punctuation.map(char => (
        <button
          key={`p-${char}`}
          className={clsx(styles.charBtn, activeChar === char && styles.active)}
          onClick={() => onSelect(char)}
        >
          {char}
        </button>
      ))}

      <div className={styles.categoryLabel}>Cyrillic Upper</div>
      {cyrillicUpper.map(char => (
        <button
          key={`cu-${char}`}
          className={clsx(styles.charBtn, activeChar === char && styles.active)}
          onClick={() => onSelect(char)}
        >
          {char}
        </button>
      ))}

      <div className={styles.categoryLabel}>Cyrillic Lower</div>
      {cyrillicLower.map(char => (
        <button
          key={`cl-${char}`}
          className={clsx(styles.charBtn, activeChar === char && styles.active)}
          onClick={() => onSelect(char)}
        >
          {char}
        </button>
      ))}

      <div className={styles.categoryLabel}>Cyrillic Extended</div>
      {cyrillicExtended.map(char => (
        <button
          key={`ce-${char}`}
          className={clsx(styles.charBtn, activeChar === char && styles.active)}
          onClick={() => onSelect(char)}
        >
          {char}
        </button>
      ))}

      <div className={styles.categoryLabel}>Math</div>
      {math.map(char => (
        <button
          key={`m-${char}`}
          className={clsx(styles.charBtn, activeChar === char && styles.active)}
          onClick={() => onSelect(char)}
        >
          {char}
        </button>
      ))}

      <div className={styles.categoryLabel}>Logic</div>
      {logic.map(char => (
        <button
          key={`l-${char}`}
          className={clsx(styles.charBtn, activeChar === char && styles.active)}
          onClick={() => onSelect(char)}
        >
          {char}
        </button>
      ))}

      <div className={styles.categoryLabel}>Arrows</div>
      {arrows.map(char => (
        <button
          key={`a-${char}`}
          className={clsx(styles.charBtn, activeChar === char && styles.active)}
          onClick={() => onSelect(char)}
        >
          {char}
        </button>
      ))}

      <div className={styles.categoryLabel}>Special</div>
      {special.map(char => (
        <button
          key={`s-${char}`}
          className={clsx(styles.charBtn, activeChar === char && styles.active)}
          onClick={() => onSelect(char)}
        >
          {char}
        </button>
      ))}

      <div className={styles.categoryLabel}>Extended</div>
      {extended.map(char => (
        <button
          key={`e-${char}`}
          className={clsx(styles.charBtn, activeChar === char && styles.active)}
          onClick={() => onSelect(char)}
        >
          {char}
        </button>
      ))}
    </div>
  )
}

export default CharPicker
