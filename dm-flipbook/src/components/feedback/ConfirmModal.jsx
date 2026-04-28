import React from 'react';
import './ConfirmModal.css';

export default function ConfirmModal({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = '確認', 
  cancelText = '取消',
  confirmBtnStyle = 'primary' // primary or danger 
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h3>{title}</h3>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="modal-btn modal-cancel-btn" onClick={onCancel}>
            {cancelText}
          </button>
          <button 
            className={`modal-btn modal-confirm-btn ${confirmBtnStyle}`} 
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}