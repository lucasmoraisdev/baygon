import React, { useState } from 'react';
import styles from './SuspendModal.module.css';

interface SuspendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (type: string, value: number) => void | Promise<void>;
}

export default function SuspendModal({ isOpen, onClose, onConfirm }: SuspendModalProps) {
  const [suspendType, setSuspendType] = useState('days');
  const [suspendValue, setSuspendValue] = useState(1);

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2>Suspender Jogador</h2>
        <div className={styles.inputGroup}>
          <label>Tipo de Suspensão:</label>
          <select 
            value={suspendType} 
            onChange={(e) => setSuspendType(e.target.value)}
            className={styles.input}
          >
            <option value="days">Por Dias</option>
            <option value="weeks">Por Semanas</option>
            <option value="games">Por Jogos</option>
            <option value="indefinite">Indefinidamente</option>
          </select>
        </div>
        
        {suspendType !== 'indefinite' && (
          <div className={styles.inputGroup}>
            <label>Quantidade ({suspendType === 'games' ? 'jogos' : suspendType === 'weeks' ? 'semanas' : 'dias'}):</label>
            <input
              type="number"
              min="1"
              value={suspendValue}
              onChange={(e) => setSuspendValue(parseInt(e.target.value))}
              className={styles.input}
            />
          </div>
        )}
        
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button
            onClick={() => onConfirm(suspendType, suspendValue)}
            className={`${styles.actionBtn} ${styles.btnRed}`}
            style={{ margin: 0 }}
          >
            Confirmar Suspensão
          </button>
          <button
            onClick={onClose}
            className={`${styles.actionBtn}`}
            style={{ background: 'var(--bg-surface)', margin: 0, border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
