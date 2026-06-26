import React from 'react';
import './ConfirmModal.css';

export default function ConfirmModal({ 
  isOpen, 
  type = 'confirm', // confirm or alert 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = '確認', 
  cancelText = '取消',
  confirmBtnStyle = 'primary' // primary or danger 
}) {
  if (!isOpen) return null;

  // Alert模式
  const titleClass = type === 'alert' ? `alert-title-${confirmBtnStyle}` : '';
  const btnStyleClass = type === 'alert' ? 'alert-black' : confirmBtnStyle;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h3 className={titleClass}>{title}</h3>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-footer">
          {type === 'confirm' && (
            <button className="modal-btn modal-cancel-btn" onClick={onCancel}>
              {cancelText}
            </button>
          )}
          <button 
            className={`modal-btn modal-confirm-btn ${btnStyleClass} ${type === 'alert' ? 'full-width' : ''}`} 
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}